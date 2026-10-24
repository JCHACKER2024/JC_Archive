/**
 * Excel_para_Data.js - gera os ficheiros JS/Data_*.js a partir dos teus Excel
 *
 * Uso (na raiz do projeto):
 *   node TOOLS/Excel_para_Data.js                  -> SIMULAÇÃO: valida e mostra o que mudava (não escreve nada)
 *   node TOOLS/Excel_para_Data.js --escrever       -> escreve os Data_*.js (guarda cópia do antigo em TOOLS/backups)
 *   node TOOLS/Excel_para_Data.js filmes           -> só uma categoria (jogos, filmes, series, animes)
 *   node TOOLS/Excel_para_Data.js --nomes          -> junta ao relatório a lista de nomes por ordem alfabética (para ver gralhas)
 *   node TOOLS/Excel_para_Data.js --tudo           -> mostra no terminal todas as linhas (por defeito só as primeiras 40)
 *   node TOOLS/Excel_para_Data.js --pasta "C:\caminho\da\pasta"   -> se a pasta dos Excel não for encontrada
 *
 * Grava SEMPRE o relatório completo em TOOLS/relatorio_excel.txt (sem limite de linhas).
 * Guarda e fecha o Excel antes de correr.
 * Se uma categoria tiver ERROS, essa categoria não é escrita.
 * Os géneros em português do Excel (Animação, Ação, Heróis...) são traduzidos para inglês.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { TOOLS_DIR, RAIZ, CATEGORIAS, slugMedia, normalizar, nomeItem, lerDados } = require('./comum');

// Se o script não encontrar a pasta dos Excel, escreve aqui o caminho completo.
// Exemplo: 'C:\\Users\\Jorge\\Desktop\\Jorge'
const PASTA_MANUAL = '';

const FONTES = {
    jogos:  { ficheiro: 'Historico_de_Jogos',      folhas: ['por tier'] },
    filmes: { ficheiro: 'Historico_Series_Filmes', folhas: ['filmes', 'filme'] },
    series: { ficheiro: 'Historico_Series_Filmes', folhas: ['series', 'serie'] },
    animes: { ficheiro: 'Historico_Series_Filmes', folhas: ['animes', 'anime'] }
};

// Palavras que identificam cada coluna pelo cabeçalho (sem acentos e em minúsculas)
const COLUNAS = {
    jogos:  { tier: ['tier'], nome: ['jogo', 'jogos'], ano: ['ano'], plataforma: ['plataforma'] },
    filmes: { tier: ['tier'], nome: ['titulo'], ano: ['ano'], genero: ['categoria', 'genero'] },
    series: { tier: ['tier'], nome: ['titulo'], season: ['season', 'seasons', 'temporada', 'temporadas'], ano: ['ano'], genero: ['categoria', 'genero'] },
    animes: { tier: ['tier'], nome: ['titulo'], season: ['season', 'seasons', 'temporada', 'temporadas'], ano: ['ano'] }
};

const TIERS = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
const PLATAFORMAS = ['Computer', 'Playstation', 'Mobile'];
const GENEROS = {
    filmes: ['Action', 'Animation', 'Anime', 'Adventure', 'Comedy', 'Drama', 'Romance', 'Superhero', 'Horror', 'Science Fiction'],
    series: ['Action', 'Animation', 'Adventure', 'Comedy', 'Drama', 'Japanese', 'Mystery']
};

// Tradução dos géneros escritos em português no Excel (chaves sem acentos e em minúsculas)
const GENEROS_PT = {
    'acao': 'Action',
    'animacao': 'Animation',
    'aventura': 'Adventure',
    'comedia': 'Comedy',
    'drama': 'Drama',
    'romance': 'Romance',
    'terror': 'Horror',
    'heroi': 'Superhero',
    'herois': 'Superhero',
    'super heroi': 'Superhero',
    'super herois': 'Superhero',
    'ficcao cientifica': 'Science Fiction',
    'misterio': 'Mystery',
    'japonesa': 'Japanese',
    'japones': 'Japanese',
    'anime': 'Anime'
};

const ANO_MAX = new Date().getFullYear() + 2;
const MAX_LISTA = process.argv.includes('--tudo') ? Infinity : 40;
const MOSTRAR_NOMES = process.argv.includes('--nomes');
const ROMANOS = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']);

/* ---------- saída: terminal + relatório ---------- */

const relatorio = [];

// escreve no terminal e no relatório
function dizer(texto = '') {
    console.log(texto);
    relatorio.push(texto);
}

// escreve só no relatório
function soFicheiro(texto = '') {
    relatorio.push(texto);
}

// o terminal mostra as primeiras linhas; o relatório leva todas
function listar(titulo, linhas) {
    if (linhas.length === 0) return;
    const cabecalho = `\n--- ${titulo} (${linhas.length}) ---`;

    console.log(cabecalho);
    linhas.slice(0, MAX_LISTA).forEach((l) => console.log(l));
    if (linhas.length > MAX_LISTA) console.log(`... e mais ${linhas.length - MAX_LISTA} (a lista completa está no relatório)`);

    soFicheiro(cabecalho);
    linhas.forEach((l) => soFicheiro(l));
}

/* ---------- módulo xlsx (instala-se sozinho dentro de TOOLS) ---------- */

function obterXlsx() {
    try {
        return require('xlsx');
    } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }

    if (process.env.JC_XLSX_REINICIADO) {
        console.error('O xlsx foi instalado mas o Node continua sem o encontrar. Corre: cd TOOLS e depois npm.cmd install xlsx');
        process.exit(1);
    }

    console.log('O módulo xlsx ainda não está instalado. A instalar dentro de TOOLS (só acontece uma vez)...');
    const pacote = path.join(TOOLS_DIR, 'package.json');
    if (!fs.existsSync(pacote)) {
        fs.writeFileSync(pacote, JSON.stringify({ name: 'jcarchive-tools', private: true }, null, 2) + '\n');
    }
    try {
        execSync('npm install xlsx', { cwd: TOOLS_DIR, stdio: 'inherit' });
    } catch (e) {
        console.error('\nNão consegui instalar o xlsx (precisas de internet e do Node/npm instalado).');
        process.exit(1);
    }

    // O Node não deteta um módulo acabado de instalar neste mesmo arranque: volta a correr o script
    console.log('\nInstalado. A voltar a correr o script...\n');
    const r = spawnSync(process.execPath, [__filename, ...process.argv.slice(2)], {
        stdio: 'inherit',
        env: { ...process.env, JC_XLSX_REINICIADO: '1' }
    });
    process.exit(r.status === null ? 1 : r.status);
}

/* ---------- localizar e abrir os Excel ---------- */

function acharPasta(argPasta) {
    const candidatos = [];
    if (argPasta) candidatos.push(argPasta);
    if (PASTA_MANUAL) candidatos.push(PASTA_MANUAL);

    const casa = os.homedir();
    const bases = [casa, path.join(casa, 'OneDrive'), process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean);
    bases.forEach((b) => ['Desktop', 'Ambiente de Trabalho'].forEach((d) => candidatos.push(path.join(b, d, 'Jorge'))));

    const unicos = [...new Set(candidatos)];
    const existentes = unicos.filter((c) => fs.existsSync(c) && fs.statSync(c).isDirectory());
    const comFicheiros = existentes.find((c) => fs.readdirSync(c).some((n) => /^Historico_/i.test(n)));
    return { pasta: comFicheiros || existentes[0] || null, tentadas: unicos };
}

function carregarWorkbook(XLSX, pasta, base) {
    for (const ext of ['.xlsm', '.xlsx']) {
        const caminho = path.join(pasta, base + ext);
        if (!fs.existsSync(caminho)) continue;
        try {
            return { wb: XLSX.read(fs.readFileSync(caminho), { type: 'buffer' }), caminho };
        } catch (e) {
            if (['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) {
                throw new Error(`Não consegui abrir ${base}${ext} (está aberto no Excel?). Guarda, fecha o Excel e tenta de novo.`);
            }
            throw new Error(`Erro a ler ${base}${ext}: ${e.message}`);
        }
    }
    throw new Error(`Não encontrei ${base}.xlsm na pasta ${pasta}`);
}

function procurarFolha(wb, palavras) {
    const nomes = wb.SheetNames;
    let achada = nomes.find((n) => palavras.includes(normalizar(n)));
    if (!achada) {
        const parecidas = nomes.filter((n) => palavras.some((p) => normalizar(n).includes(p)));
        if (parecidas.length === 1) achada = parecidas[0];
    }
    return achada || null;
}

/* ---------- leitura e limpeza dos valores ---------- */

function limpar(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function lerTier(bruto) {
    const t = limpar(bruto).replace(/\s+/g, '').toUpperCase();
    return TIERS.includes(t) ? t : null;
}

function lerAno(bruto, permiteMixed) {
    const t = limpar(bruto);
    if (permiteMixed && /^mixed$/i.test(t)) return 'Mixed';
    if (/^\d{4}$/.test(t)) {
        const n = Number(t);
        if (n >= 1900 && n <= ANO_MAX) return n;
    }
    return null;
}

function lerSeasons(bruto) {
    if (typeof bruto === 'number' && !Number.isInteger(bruto)) {
        return { erro: `"${bruto}" parece ter sido convertido em número pelo Excel (vírgula decimal). Escreve as seasons como texto, por exemplo 1, 2` };
    }
    const tokens = limpar(bruto).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (tokens.length === 0) return { erro: 'sem season' };

    const invalidos = tokens.filter((t) => !/^[1-9]\d*$/.test(t));
    if (invalidos.length > 0) return { erro: `season inválida: ${invalidos.join(', ')}` };
    if (new Set(tokens).size !== tokens.length) return { erro: `season repetida na mesma linha (${tokens.join(', ')})` };

    return { valor: tokens.map(Number).sort((a, b) => a - b).join(', ') };
}

function traduzirGenero(chave, parte) {
    const direto = GENEROS[chave].find((g) => normalizar(g) === normalizar(parte));
    if (direto) return direto;
    const traduzido = GENEROS_PT[normalizar(parte)];
    return traduzido && GENEROS[chave].includes(traduzido) ? traduzido : undefined;
}

function lerGenero(chave, bruto) {
    const t = limpar(bruto);
    if (!t) return { erro: 'sem género' };

    const partes = t.split('/').map((p) => p.trim()).filter(Boolean);
    const canonicas = partes.map((p) => traduzirGenero(chave, p));
    const invalidas = partes.filter((_, i) => !canonicas[i]);
    if (invalidas.length > 0) {
        return { erro: `género inválido "${invalidas.join(' / ')}" (aceites: ${GENEROS[chave].join(', ')}, ou o equivalente em português)` };
    }
    return { valor: canonicas.join(' / ') };
}

function lerPlataforma(bruto) {
    const t = limpar(bruto);
    if (!t) return { erro: 'sem plataforma' };
    const p = PLATAFORMAS.find((x) => normalizar(x) === normalizar(t));
    return p ? { valor: p } : { erro: `plataforma inválida "${t}" (aceites: ${PLATAFORMAS.join(', ')})` };
}

/* ---------- repetições e nomes parecidos ---------- */

function distancia(a, b) {
    const m = a.length;
    const n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            d[i][j] = Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return d[m][n];
}

// Tira algarismos e algarismos romanos (ex.: "far cry 3" e "far cry 4" ficam iguais: é uma sequela, não uma repetição)
function semNumeros(s) {
    return s.split(' ').filter((t) => t && !/^\d+$/.test(t) && !ROMANOS.has(t)).join(' ');
}

function quaseIguais(a, b) {
    if (a === b || Math.min(a.length, b.length) < 8 || Math.abs(a.length - b.length) > 2) return false;
    if (semNumeros(a) === semNumeros(b)) return false;
    return distancia(a, b) <= 2;
}

/* ---------- ordenação, formato e comparação ---------- */

function ordenar(itens) {
    return itens
        .map((it, i) => ({ it, i }))
        .sort((x, y) => {
            const a = x.it;
            const b = y.it;
            const t = TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier);
            if (t !== 0) return t;

            const am = a.ano === 'Mixed';
            const bm = b.ano === 'Mixed';
            if (am !== bm) return am ? 1 : -1;
            if (am) {
                const ta = a.nome.toLowerCase();
                const tb = b.nome.toLowerCase();
                if (ta !== tb) return ta < tb ? -1 : 1;
                return x.i - y.i;
            }
            if (a.ano !== b.ano) return a.ano - b.ano;
            return x.i - y.i;
        })
        .map((x) => x.it);
}

function linhaObjeto(chave, it) {
    const c = [['tier', it.tier]];
    if (chave === 'jogos') c.push(['jogo', it.nome], ['ano', it.ano], ['plataforma', it.plataforma], ['img', it.img]);
    else if (chave === 'filmes') c.push(['titulo', it.nome], ['ano', it.ano], ['genero', it.genero], ['img', it.img]);
    else if (chave === 'series') c.push(['titulo', it.nome], ['season', it.season], ['ano', it.ano], ['genero', it.genero]);
    else c.push(['titulo', it.nome], ['season', it.season], ['ano', it.ano]);
    return `{${c.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}}`;
}

function gerarFicheiro(chave, cfg, itens) {
    const linhas = [`const ${cfg.variavel} = [`];
    let tierAtual = null;

    itens.forEach((it, i) => {
        if (it.tier !== tierAtual) {
            if (tierAtual !== null) linhas.push('');
            linhas.push(`    // --- TIER ${it.tier} ---`);
            tierAtual = it.tier;
        }
        linhas.push(`    ${linhaObjeto(chave, it)}${i < itens.length - 1 ? ',' : ''}`);
    });

    linhas.push('];', '');
    return linhas.join('\n');
}

// Converte uma entrada do Data_*.js atual para o mesmo formato interno do Excel
function paraInterno(chave, it) {
    const interno = { tier: String(it.tier || '').toUpperCase(), nome: nomeItem(it), ano: it.ano };
    if (chave === 'jogos') interno.plataforma = it.plataforma;
    if (chave === 'filmes' || chave === 'series') interno.genero = it.genero;
    if (chave === 'series' || chave === 'animes') {
        interno.season = String(it.season || '').split(',').map((s) => s.trim()).filter(Boolean).join(', ');
    }
    return interno;
}

function expandir(chave, it) {
    const v = (x) => (x === undefined ? '' : x);
    const base = normalizar(it.nome);
    const valor = chave === 'jogos' ? `${it.tier} | ${v(it.plataforma)}`
        : chave === 'filmes' ? `${it.tier} | ${v(it.genero)}`
            : chave === 'series' ? `${it.tier} | ${it.ano} | ${v(it.genero)}`
                : `${it.tier} | ${it.ano}`;

    if (chave === 'jogos' || chave === 'filmes') {
        return [{ k: `${base}|${it.ano}`, rotulo: `${it.nome} (${it.ano})`, valor }];
    }
    return String(it.season).split(',').map((s) => s.trim()).filter(Boolean)
        .map((s) => ({ k: `${base}|${s}`, rotulo: `${it.nome} season ${s}`, valor }));
}

function diferencas(chave, antigos, novos) {
    const mapa = (lista) => {
        const m = new Map();
        lista.forEach((it) => expandir(chave, it).forEach((e) => m.set(e.k, e)));
        return m;
    };
    const mAntigo = mapa(antigos);
    const mNovo = mapa(novos);

    const adicionados = [];
    const removidos = [];
    const alterados = [];

    mNovo.forEach((e, k) => {
        if (!mAntigo.has(k)) adicionados.push(`+ ${e.rotulo}  [${e.valor}]`);
        else if (mAntigo.get(k).valor !== e.valor) alterados.push(`~ ${e.rotulo}: ${mAntigo.get(k).valor}  ->  ${e.valor}`);
    });
    mAntigo.forEach((e, k) => {
        if (!mNovo.has(k)) removidos.push(`- ${e.rotulo}  [${e.valor}]`);
    });

    return { adicionados, removidos, alterados };
}

function dataHora() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

/* ---------- processar uma categoria ---------- */

function processar(chave, XLSX, pasta, cache, escrever) {
    const cfg = CATEGORIAS[chave];
    const fonte = FONTES[chave];
    const spec = COLUNAS[chave];
    const temSeasons = chave === 'series' || chave === 'animes';
    const erros = [];
    const avisos = [];

    dizer(`\n==================== ${cfg.nome} ====================`);

    let livro;
    try {
        if (!cache.has(fonte.ficheiro)) cache.set(fonte.ficheiro, carregarWorkbook(XLSX, pasta, fonte.ficheiro));
        livro = cache.get(fonte.ficheiro);
    } catch (e) {
        dizer(`ERRO: ${e.message}`);
        return false;
    }

    const nomeFolha = procurarFolha(livro.wb, fonte.folhas);
    if (!nomeFolha) {
        dizer(`ERRO: não encontrei a folha (${fonte.folhas.join(' / ')}) em ${path.basename(livro.caminho)}. Folhas existentes: ${livro.wb.SheetNames.join(', ')}`);
        return false;
    }

    const ws = livro.wb.Sheets[nomeFolha];
    if (!ws || !ws['!ref']) {
        dizer(`ERRO: a folha "${nomeFolha}" está vazia.`);
        return false;
    }

    const intervalo = XLSX.utils.decode_range(ws['!ref']);
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: true });
    const excelLinha = (i) => intervalo.s.r + i + 1;
    const letra = (idx) => XLSX.utils.encode_col(intervalo.s.c + idx);

    // colunas pelos cabeçalhos
    const cabecalho = (linhas[0] || []).map(limpar);
    const idx = {};
    const faltam = [];
    Object.entries(spec).forEach(([campo, palavras]) => {
        const i = cabecalho.findIndex((h) => normalizar(h).split(' ').some((p) => palavras.includes(p)));
        if (i === -1) faltam.push(campo);
        else idx[campo] = i;
    });

    dizer(`Ficheiro: ${path.basename(livro.caminho)} | Folha: "${nomeFolha}"`);
    if (faltam.length > 0) {
        dizer(`ERRO: não encontrei as colunas: ${faltam.join(', ')}. Cabeçalhos da folha: ${cabecalho.filter(Boolean).join(' | ')}`);
        return false;
    }
    dizer(`Colunas: ${Object.entries(idx).map(([c, i]) => `${c}=${letra(i)}`).join(', ')}`);

    // linhas
    const itens = [];
    for (let i = 1; i < linhas.length; i++) {
        const linha = linhas[i];
        const get = (campo) => linha[idx[campo]];
        if (Object.keys(idx).every((c) => limpar(get(c)) === '')) continue;

        const n = excelLinha(i);
        const nome = limpar(get('nome'));
        if (!nome) {
            erros.push(`linha ${n}: sem nome`);
            continue;
        }
        if (String(get('nome')).replace(/\u00a0/g, ' ') !== nome) avisos.push(`linha ${n}: "${nome}" tinha espaços a mais (corrigi no resultado)`);

        const antes = erros.length;
        const erro = (msg) => erros.push(`linha ${n}: "${nome}" - ${msg}`);
        const it = { nome, linhaExcel: n };

        const tier = lerTier(get('tier'));
        if (!tier) erro(`tier inválido (${limpar(get('tier')) || 'vazio'})`);
        else it.tier = tier;

        const ano = lerAno(get('ano'), temSeasons);
        if (ano === null) erro(`ano inválido (${limpar(get('ano')) || 'vazio'})${temSeasons ? '; para várias seasons escreve Mixed' : ''}`);
        else it.ano = ano;

        if (chave === 'jogos') {
            const p = lerPlataforma(get('plataforma'));
            if (p.erro) erro(p.erro); else it.plataforma = p.valor;
        }

        if (chave === 'filmes' || chave === 'series') {
            const g = lerGenero(chave, get('genero'));
            if (g.erro) erro(g.erro); else it.genero = g.valor;
        }

        if (temSeasons) {
            const s = lerSeasons(get('season'));
            if (s.erro) erro(s.erro);
            else {
                it.season = s.valor;
                if (it.ano === 'Mixed' && s.valor.split(',').length < 2) avisos.push(`linha ${n}: "${nome}" tem ano "Mixed" mas só uma season`);
            }
        }

        if (erros.length === antes) {
            if (chave === 'jogos' || chave === 'filmes') it.img = `${cfg.pasta}/${slugMedia(nome)}-${it.ano}.jpg`;
            itens.push(it);
        }
    }

    // repetições
    const vistos = new Map();
    itens.forEach((it) => {
        const chaves = (chave === 'jogos' || chave === 'filmes')
            ? [`${normalizar(it.nome)}|${it.ano}`]
            : it.season.split(',').map((s) => `${normalizar(it.nome)}|${s.trim()}`);

        chaves.forEach((k) => {
            if (vistos.has(k)) {
                const motivo = temSeasons ? `season ${k.split('|')[1]} repetida` : `repetido (${it.ano})`;
                erros.push(`linha ${it.linhaExcel}: "${it.nome}" - ${motivo} (já na linha ${vistos.get(k)})`);
            } else {
                vistos.set(k, it.linhaExcel);
            }
        });
    });

    const porNome = new Map();
    itens.forEach((it) => {
        const k = normalizar(it.nome);
        if (!porNome.has(k)) porNome.set(k, { escritas: new Set(), anos: new Set() });
        porNome.get(k).escritas.add(it.nome);
        porNome.get(k).anos.add(it.ano);
    });

    porNome.forEach((info) => {
        if (info.escritas.size > 1) avisos.push(`mesmo nome escrito de formas diferentes: ${[...info.escritas].map((s) => `"${s}"`).join(' / ')}`);
        if (!temSeasons && info.anos.size > 1) avisos.push(`mesmo nome em anos diferentes: "${[...info.escritas][0]}" (${[...info.anos].join(', ')})`);
    });

    const chavesNomes = [...porNome.keys()];
    for (let a = 0; a < chavesNomes.length; a++) {
        for (let b = a + 1; b < chavesNomes.length; b++) {
            if (quaseIguais(chavesNomes[a], chavesNomes[b])) {
                avisos.push(`nomes muito parecidos: "${[...porNome.get(chavesNomes[a]).escritas][0]}" e "${[...porNome.get(chavesNomes[b]).escritas][0]}"`);
            }
        }
    }

    dizer(`Linhas válidas: ${itens.length}`);
    listar('ERROS', erros);
    listar('AVISOS', avisos);

    // lista de nomes por ordem alfabética (só no relatório) para procurar gralhas
    if (MOSTRAR_NOMES) {
        soFicheiro(`\n--- NOMES POR ORDEM ALFABÉTICA, para procurar gralhas (${itens.length}) ---`);
        [...itens]
            .sort((a, b) => normalizar(a.nome).localeCompare(normalizar(b.nome)))
            .forEach((it) => soFicheiro(temSeasons
                ? `${it.nome}  |  season ${it.season}  |  ${it.tier}  |  linha ${it.linhaExcel}`
                : `${it.nome}  |  ${it.ano}  |  ${it.tier}  |  linha ${it.linhaExcel}`));
    }

    if (erros.length > 0) {
        dizer('\nNÃO escrito: corrige os erros no Excel e corre outra vez.');
        return false;
    }

    // comparação com o ficheiro atual
    const ordenados = ordenar(itens);
    const texto = gerarFicheiro(chave, cfg, ordenados);
    const destino = path.join(RAIZ, cfg.ficheiro);
    const textoAntigo = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8').replace(/\r\n/g, '\n') : null;

    let antigos = [];
    try {
        antigos = lerDados(cfg).dados.map((it) => paraInterno(chave, it));
    } catch (e) {
        dizer('(não consegui ler o ficheiro atual para comparar)');
    }

    const dif = diferencas(chave, antigos, ordenados);
    dizer(`\nEntradas: antes ${antigos.length}, depois ${ordenados.length}`);
    listar('NOVOS', dif.adicionados);
    listar('REMOVIDOS', dif.removidos);
    listar('ALTERADOS', dif.alterados);

    if (textoAntigo === texto) {
        dizer('\nSem alterações: o ficheiro já está igual ao Excel.');
        return true;
    }
    if (dif.adicionados.length + dif.removidos.length + dif.alterados.length === 0) {
        dizer('\nOs dados são os mesmos; só mudaria a formatação ou a escrita dos nomes.');
    }

    if (!escrever) {
        dizer('\nSIMULAÇÃO: nada foi escrito. Para escrever: node TOOLS/Excel_para_Data.js --escrever');
        return true;
    }

    if (textoAntigo !== null) {
        const dirBackup = path.join(TOOLS_DIR, 'backups');
        fs.mkdirSync(dirBackup, { recursive: true });
        const copia = path.join(dirBackup, `${path.basename(cfg.ficheiro, '.js')}_${dataHora()}.js`);
        fs.copyFileSync(destino, copia);
        dizer(`\nCópia do ficheiro antigo: TOOLS/backups/${path.basename(copia)}`);
    }

    fs.writeFileSync(destino, texto);
    dizer(`ESCRITO: ${cfg.ficheiro}`);
    return true;
}

/* ---------- main ---------- */

function main() {
    const args = process.argv.slice(2);
    const escrever = args.includes('--escrever');
    const iPasta = args.indexOf('--pasta');
    const argPasta = iPasta !== -1 ? args[iPasta + 1] : '';

    const pedidas = args.map((a) => a.toLowerCase()).filter((a) => FONTES[a]);
    const escolhidas = pedidas.length > 0 ? pedidas : Object.keys(FONTES);

    const { pasta, tentadas } = acharPasta(argPasta);
    if (!pasta) {
        console.log('Não encontrei a pasta dos Excel. Procurei em:');
        tentadas.forEach((c) => console.log(`  ${c}`));
        console.log('\nCorre com --pasta "C:\\caminho\\da\\pasta" ou escreve o caminho em PASTA_MANUAL no início deste ficheiro.');
        process.exit(1);
    }

    dizer(`Pasta dos Excel: ${pasta}`);
    dizer(escrever ? 'Modo: ESCREVER' : 'Modo: SIMULAÇÃO (não escreve nada)');

    const XLSX = obterXlsx();
    const cache = new Map();
    const resultados = {};
    escolhidas.forEach((chave) => {
        resultados[chave] = processar(chave, XLSX, pasta, cache, escrever);
    });

    dizer('\n==================== RESUMO ====================');
    Object.entries(resultados).forEach(([chave, ok]) => dizer(`${CATEGORIAS[chave].nome}: ${ok ? 'OK' : 'COM ERROS (não escrito)'}`));

    if (escrever && Object.values(resultados).some(Boolean)) {
        dizer('\nA seguir: node TOOLS/Validar_Dados.js, node TOOLS/Verificar_Imagens.js e node TOOLS/Get_Capas.js para os itens novos.');
    }

    // relatório completo
    const ficheiroRelatorio = path.join(TOOLS_DIR, 'relatorio_excel.txt');
    const cabecalho = `Relatório de ${new Date().toLocaleString('pt-PT')} (${escrever ? 'ESCREVER' : 'SIMULAÇÃO'})`;
    fs.writeFileSync(ficheiroRelatorio, [cabecalho, '', ...relatorio].join('\n') + '\n');
    console.log('\nRelatório completo (todos os erros e avisos): TOOLS/relatorio_excel.txt');
    console.log('Para o abrir: notepad TOOLS\\relatorio_excel.txt');

    process.exitCode = Object.values(resultados).every(Boolean) ? 0 : 1;
}

main();