/**
 * Get_Capas.js - descarrega as capas que faltam (NUNCA substitui imagens que já existem)
 *
 * Uso (na raiz do projeto):
 *   node TOOLS/Get_Capas.js            -> jogos, filmes, séries e animes
 *   node TOOLS/Get_Capas.js jogos      -> só uma categoria (jogos, filmes, series, animes)
 *
 * Fontes:
 *   Séries e animes -> TVMaze (sem conta nem chave)
 *   Filmes          -> TMDB   (chave em TOOLS/chaves.js)
 *   Jogos           -> IGDB   (chaves em TOOLS/chaves.js)
 *
 * Tudo é guardado em .jpg com 300 px de largura.
 * Os casos duvidosos ficam em TOOLS/relatorio_capas.txt
 */

const fs = require('fs');
const path = require('path');
const {
    TOOLS_DIR, CATEGORIAS, slug, slugMedia, normalizar, nomeItem, listaSeasons,
    lerDados, estadoImagem, guardarCapa, esperar
} = require('./comum');

const PLACEHOLDER = 'COLOCAR AQUI CHAVE FUNCIONAL';
const TVMAZE = 'https://api.tvmaze.com';
const TMDB = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w342';
const IGDB_IMG = 'https://images.igdb.com/igdb/image/upload/t_cover_big';

let chaves = {};
try {
    chaves = require('./chaves');
} catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') console.log(`Erro a ler TOOLS/chaves.js: ${e.message}`);
}

const TMDB_API_KEY = chaves.TMDB_API_KEY || PLACEHOLDER;
const IGDB_CLIENT_ID = chaves.IGDB_CLIENT_ID || PLACEHOLDER;
const IGDB_CLIENT_SECRET = chaves.IGDB_CLIENT_SECRET || PLACEHOLDER;

const chaveOk = (valor) => !!valor && !/COLOCAR AQUI/i.test(valor);

function avisoChave(categoria, campos) {
    console.log('\n##################################################################');
    console.log(`  COLOCAR AQUI CHAVE FUNCIONAL  ->  ${categoria}`);
    console.log(`  Abre TOOLS/chaves.js (cria o ficheiro se não existir) e preenche: ${campos}`);
    console.log('  Esta categoria foi ignorada.');
    console.log('##################################################################');
}

async function pedirJSON(url, opcoes = {}, pausa = 300) {
    for (let tentativa = 0; tentativa < 4; tentativa++) {
        const res = await fetch(url, opcoes);
        if (res.status === 429) {
            await esperar(3000);
            continue;
        }
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status} em ${url.split('?')[0]}`);
        const json = await res.json();
        await esperar(pausa);
        return json;
    }
    throw new Error(`Demasiados pedidos (429) em ${url.split('?')[0]}`);
}

async function descarregar(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao descarregar a imagem`);
    return Buffer.from(await res.arrayBuffer());
}

// 'ok' se guardou, 'existe' se o ficheiro já existia (nunca substitui)
async function guardar(destinoRel, url) {
    try {
        await guardarCapa(await descarregar(url), destinoRel);
        return 'ok';
    } catch (e) {
        if (e.code === 'EEXIST') return 'existe';
        throw e;
    }
}

/* ---------- SÉRIES E ANIMES (TVMaze) ---------- */

async function procurarShow(titulo, anime) {
    const resultados = await pedirJSON(`${TVMAZE}/search/shows?q=${encodeURIComponent(titulo)}`, {}, 600);
    if (!resultados || resultados.length === 0) return null;

    const eAnime = (r) => (r.show.genres || []).includes('Anime');
    const preferido = resultados.find((r) => eAnime(r) === anime);
    return (preferido || resultados[0]).show;
}

async function processarSeries(cfg, relatorio) {
    const anime = cfg.nome === 'ANIMES';
    const { dados } = lerDados(cfg);

    const porTitulo = new Map();
    dados.forEach((item) => {
        listaSeasons(item).forEach((s) => {
            if (!porTitulo.has(item.titulo)) porTitulo.set(item.titulo, new Set());
            porTitulo.get(item.titulo).add(s);
        });
    });

    console.log(`\n=== ${cfg.nome} (${porTitulo.size} títulos) ===`);
    let guardadas = 0;
    let existentes = 0;

    for (const [titulo, seasonsSet] of porTitulo) {
        const porFazer = [];
        [...seasonsSet].sort((a, b) => Number(a) - Number(b)).forEach((s) => {
            const destino = `${cfg.pasta}/${slug(titulo)}-s${s}.jpg`;
            const est = estadoImagem(destino);
            if (est.estado === 'falta') {
                porFazer.push({ s, destino });
            } else {
                existentes++;
                if (est.estado === 'parecido') {
                    relatorio.push(`${cfg.nome}: ${titulo} season ${s} - já existe "${est.parecido}" com nome ou extensão diferente do esperado; não mexi`);
                }
            }
        });
        if (porFazer.length === 0) continue;

        try {
            const show = await procurarShow(titulo, anime);
            if (!show) {
                console.log(`[X] ${titulo}: não encontrado`);
                porFazer.forEach(({ s }) => relatorio.push(`${cfg.nome}: ${titulo} season ${s} - show não encontrado`));
                continue;
            }

            const ano = show.premiered ? show.premiered.slice(0, 4) : '?';
            console.log(`• ${titulo} -> "${show.name}" (${ano}) [id ${show.id}]`);

            const seasonsApi = (await pedirJSON(`${TVMAZE}/shows/${show.id}/seasons`, {}, 600)) || [];

            for (const { s, destino } of porFazer) {
                const dadosSeason = seasonsApi.find((x) => String(x.number) === String(s));
                let url = dadosSeason && dadosSeason.image ? (dadosSeason.image.original || dadosSeason.image.medium) : null;
                let soPoster = false;

                if (!url && show.image) {
                    url = show.image.original || show.image.medium;
                    soPoster = true;
                }
                if (!url) {
                    console.log(`  [X] season ${s}: sem imagem`);
                    relatorio.push(`${cfg.nome}: ${titulo} season ${s} - sem imagem na API`);
                    continue;
                }

                const resultado = await guardar(destino, url);
                if (resultado === 'ok') {
                    guardadas++;
                    console.log(`  [OK] season ${s}${soPoster ? ' (poster da série)' : ''}`);
                    if (soPoster) relatorio.push(`${cfg.nome}: ${titulo} season ${s} - só o poster da série (a season não tem capa própria)`);
                } else {
                    existentes++;
                }
            }
        } catch (e) {
            console.log(`[X] ${titulo}: ${e.message}`);
            porFazer.forEach(({ s }) => relatorio.push(`${cfg.nome}: ${titulo} season ${s} - erro: ${e.message}`));
        }
    }

    console.log(`\n${cfg.nome}: ${guardadas} novas, ${existentes} já existiam.`);
}

/* ---------- JOGOS E FILMES (percurso comum) ---------- */

async function processarItens(cfg, relatorio, procurarCapa) {
    const { dados } = lerDados(cfg);
    console.log(`\n=== ${cfg.nome} (${dados.length} itens) ===`);
    let guardadas = 0;
    let existentes = 0;

    for (const item of dados) {
        const nome = nomeItem(item);
        const ano = Number(item.ano);
        const destino = item.img || `${cfg.pasta}/${slugMedia(nome)}-${ano}.jpg`;

        if (!item.img) {
            relatorio.push(`${cfg.nome}: "${nome}" não tem img nos dados. Se a capa for descarregada, acrescenta img: "${destino}"`);
        }

        if (!path.posix.normalize(destino).startsWith(`${cfg.pasta}/`)) {
            relatorio.push(`${cfg.nome}: "${nome}" - img "${destino}" fora de ${cfg.pasta}/; ignorado`);
            continue;
        }

        const est = estadoImagem(destino);
        if (est.estado !== 'falta') {
            existentes++;
            if (est.estado === 'parecido') {
                relatorio.push(`${cfg.nome}: "${nome}" - já existe "${est.parecido}" com nome ou extensão diferente de "${destino}"; não mexi`);
            }
            continue;
        }

        if (!/\.jpg$/.test(destino)) {
            relatorio.push(`${cfg.nome}: "${nome}" - img "${destino}" não termina em .jpg; ignorado`);
            continue;
        }

        try {
            const achado = await procurarCapa(nome, ano);
            if (!achado) {
                console.log(`[X] ${nome} (${ano}): sem resultado`);
                relatorio.push(`${cfg.nome}: "${nome}" (${ano}) - SEM RESULTADO na API`);
                continue;
            }

            const resultado = await guardar(destino, achado.url);
            if (resultado === 'ok') {
                guardadas++;
                console.log(`[OK] ${nome} (${ano}) -> "${achado.nome}"${achado.certa ? '' : '  [A CONFIRMAR]'}`);
                if (!achado.certa) {
                    relatorio.push(`${cfg.nome}: "${nome}" (${ano}) - A CONFIRMAR: encontrei "${achado.nome}" (${achado.nota}) -> ${destino}`);
                }
            } else {
                existentes++;
            }
        } catch (e) {
            console.log(`[X] ${nome}: ${e.message}`);
            relatorio.push(`${cfg.nome}: "${nome}" (${ano}) - erro: ${e.message}`);
        }
    }

    console.log(`\n${cfg.nome}: ${guardadas} novas, ${existentes} já existiam.`);
}

/* ---------- FILMES (TMDB) ---------- */

async function processarFilmes(cfg, relatorio) {
    if (!chaveOk(TMDB_API_KEY)) {
        avisoChave('FILMES (TMDB)', 'TMDB_API_KEY');
        return;
    }

    const bearer = TMDB_API_KEY.length > 40;
    const headers = { Accept: 'application/json' };
    if (bearer) headers.Authorization = `Bearer ${TMDB_API_KEY}`;

    const teste = await fetch(`${TMDB}/configuration${bearer ? '' : `?api_key=${encodeURIComponent(TMDB_API_KEY)}`}`, { headers });
    if (teste.status === 401) {
        avisoChave('FILMES (TMDB) - a chave foi recusada', 'TMDB_API_KEY');
        return;
    }

    async function procurarFilme(nome, ano) {
        const q = nome.replace(/\s+Live Action$/i, '').trim();
        const alvo = normalizar(q);

        for (const comAno of [true, false]) {
            const params = new URLSearchParams({ query: q, include_adult: 'false' });
            if (comAno) params.set('year', String(ano));
            if (!bearer) params.set('api_key', TMDB_API_KEY);

            const res = await pedirJSON(`${TMDB}/search/movie?${params}`, { headers }, 300);
            const lista = ((res && res.results) || []).filter((r) => r.poster_path);
            const anoDe = (r) => (r.release_date ? Number(r.release_date.slice(0, 4)) : null);
            const perto = (r) => anoDe(r) !== null && Math.abs(anoDe(r) - ano) <= 1;
            const nomeIgual = (r) => [r.title, r.original_title].some((t) => t && normalizar(t) === alvo);

            let r = lista.find((x) => nomeIgual(x) && perto(x));
            if (r) return { url: TMDB_IMG + r.poster_path, nome: r.title, certa: true };

            r = lista.find(perto);
            if (r) return { url: TMDB_IMG + r.poster_path, nome: r.title, certa: false, nota: 'título diferente' };
        }
        return null;
    }

    await processarItens(cfg, relatorio, procurarFilme);
}

/* ---------- JOGOS (IGDB) ---------- */

async function processarJogos(cfg, relatorio) {
    if (!chaveOk(IGDB_CLIENT_ID) || !chaveOk(IGDB_CLIENT_SECRET)) {
        avisoChave('JOGOS (IGDB)', 'IGDB_CLIENT_ID e IGDB_CLIENT_SECRET');
        return;
    }

    const urlToken = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(IGDB_CLIENT_ID)}`
        + `&client_secret=${encodeURIComponent(IGDB_CLIENT_SECRET)}&grant_type=client_credentials`;
    const resToken = await fetch(urlToken, { method: 'POST' });
    if (!resToken.ok) {
        avisoChave('JOGOS (IGDB) - as chaves foram recusadas', 'IGDB_CLIENT_ID e IGDB_CLIENT_SECRET');
        return;
    }
    const { access_token: token } = await resToken.json();

    async function procurarJogo(nome, ano) {
        const corpo = `search "${nome.replace(/["\\]/g, '')}"; fields name,first_release_date,cover.image_id; limit 10;`;
        const res = await pedirJSON('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: { 'Client-ID': IGDB_CLIENT_ID, Authorization: `Bearer ${token}`, Accept: 'application/json' },
            body: corpo
        }, 300);

        const lista = (res || []).filter((g) => g.cover && g.cover.image_id);
        const alvo = normalizar(nome);
        const anoDe = (g) => (g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null);
        const perto = (g) => anoDe(g) !== null && Math.abs(anoDe(g) - ano) <= 1;
        const mesmoNome = (g) => normalizar(g.name) === alvo;
        const url = (g) => `${IGDB_IMG}/${g.cover.image_id}.jpg`;

        let g = lista.find((x) => mesmoNome(x) && perto(x));
        if (g) return { url: url(g), nome: g.name, certa: true };

        g = lista.find(mesmoNome);
        if (g) return { url: url(g), nome: g.name, certa: false, nota: 'ano diferente' };

        g = lista.find((x) => perto(x) && (normalizar(x.name).includes(alvo) || alvo.includes(normalizar(x.name))));
        if (g) return { url: url(g), nome: g.name, certa: false, nota: 'nome parecido' };

        return null;
    }

    await processarItens(cfg, relatorio, procurarJogo);
}

/* ---------- MAIN ---------- */

async function main() {
    if (typeof fetch !== 'function') {
        console.error('Precisas de Node 18 ou superior (node -v).');
        process.exit(1);
    }

    const arg = (process.argv[2] || '').toLowerCase();
    const escolhidas = arg ? [arg] : ['jogos', 'filmes', 'series', 'animes'];

    for (const chave of escolhidas) {
        if (!CATEGORIAS[chave]) {
            console.error(`Categoria desconhecida: "${chave}". Usa jogos, filmes, series ou animes.`);
            process.exit(1);
        }
    }

    const relatorio = [];
    for (const chave of escolhidas) {
        const cfg = CATEGORIAS[chave];
        if (chave === 'series' || chave === 'animes') await processarSeries(cfg, relatorio);
        else if (chave === 'filmes') await processarFilmes(cfg, relatorio);
        else await processarJogos(cfg, relatorio);
    }

    const ficheiroRelatorio = path.join(TOOLS_DIR, 'relatorio_capas.txt');
    if (relatorio.length > 0) {
        fs.writeFileSync(ficheiroRelatorio, relatorio.join('\n') + '\n');
        console.log(`\n${relatorio.length} a rever (ver TOOLS/relatorio_capas.txt).`);
    } else {
        if (fs.existsSync(ficheiroRelatorio)) fs.unlinkSync(ficheiroRelatorio);
        console.log('\nTudo feito, nada a rever.');
    }
}

main().catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
});