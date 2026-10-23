/**
 * Validar_Dados.js - verifica os ficheiros JS/Data_*.js
 * Uso (na raiz do projeto): node TOOLS/Validar_Dados.js
 * Só lê. Termina com erro (código 1) se houver ERROS. Os AVISOS não contam.
 * Não apanha gralhas no texto dos títulos.
 */

const { CATEGORIAS, lerDados, nomeItem, listaSeasons, normalizar, slugMedia } = require('./comum');

const TIERS = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
const PLATAFORMAS = ['Computer', 'Playstation', 'Mobile'];
const GENEROS = {
    filmes: ['Action', 'Animation', 'Anime', 'Adventure', 'Comedy', 'Drama', 'Romance', 'Superhero', 'Horror', 'Science Fiction'],
    series: ['Action', 'Animation', 'Adventure', 'Comedy', 'Drama', 'Japanese', 'Mystery']
};
const ANO_MAX = new Date().getFullYear() + 2;

function validar(chave, cfg) {
    const erros = [];
    const avisos = [];

    let lido;
    try {
        lido = lerDados(cfg);
    } catch (e) {
        erros.push(`Não consegui ler ${cfg.ficheiro}: ${e.message}`);
        return { total: 0, erros, avisos };
    }

    const { dados, linhas } = lido;
    const onde = (i) => (linhas ? `linha ${linhas[i]}` : `entrada ${i + 1}`);
    const erro = (i, msg) => erros.push(`${onde(i)}: ${msg}`);
    const aviso = (i, msg) => avisos.push(`${onde(i)}: ${msg}`);

    const temSeasons = chave === 'series' || chave === 'animes';
    const vistos = new Map();
    const imagens = new Map();
    const estadoTier = {};
    let ultimoTier = -1;

    dados.forEach((item, i) => {
        const nome = nomeItem(item);
        if (!nome.trim()) {
            erro(i, 'sem nome');
            return;
        }
        if (nome !== nome.trim() || /\s{2,}/.test(nome)) aviso(i, `"${nome}" tem espaços a mais`);

        // tier
        const tierKey = String(item.tier || '').toUpperCase();
        const ti = TIERS.indexOf(tierKey);
        if (ti === -1) {
            erro(i, `"${nome}": tier inválido (${item.tier})`);
        } else {
            if (item.tier !== tierKey) aviso(i, `"${nome}": tier "${item.tier}" devia estar em maiúsculas`);
            if (ti < ultimoTier) aviso(i, `"${nome}": tier ${tierKey} fora de ordem (esperado S+, S, A, B, C, D, F)`);
            ultimoTier = Math.max(ultimoTier, ti);
        }

        // ano
        const eMixed = item.ano === 'Mixed';
        if (eMixed && !temSeasons) {
            erro(i, `"${nome}": "Mixed" só é válido em séries e animes`);
        } else if (!eMixed && !(Number.isInteger(item.ano) && item.ano >= 1900 && item.ano <= ANO_MAX)) {
            erro(i, `"${nome}": ano inválido (${item.ano})`);
        }

        // ordem dentro do tier: anos por ordem; "Mixed" no fim e por ordem alfabética
        if (ti !== -1) {
            const st = estadoTier[tierKey] || (estadoTier[tierKey] = { ano: 0, mixed: false, titulo: '' });
            if (eMixed) {
                const t = nome.toLowerCase();
                if (st.mixed && t < st.titulo) aviso(i, `"${nome}": fora de ordem alfabética entre os "Mixed"`);
                st.mixed = true;
                st.titulo = t;
            } else if (typeof item.ano === 'number') {
                if (st.mixed) aviso(i, `"${nome}": item com ano depois dos "Mixed"`);
                else if (item.ano < st.ano) aviso(i, `"${nome}": ano ${item.ano} depois de ${st.ano}`);
                st.ano = Math.max(st.ano, item.ano);
            }
        }

        // plataforma (jogos)
        if (chave === 'jogos' && !PLATAFORMAS.includes(item.plataforma)) {
            erro(i, `"${nome}": plataforma inválida (${item.plataforma})`);
        }

        // género (filmes e séries)
        if (GENEROS[chave]) {
            if (!item.genero) {
                erro(i, `"${nome}": sem género`);
            } else {
                String(item.genero).split('/').map((g) => g.trim()).forEach((g) => {
                    if (!GENEROS[chave].includes(g)) erro(i, `"${nome}": género "${g}" não existe no filtro da página`);
                });
            }
        }

        if (temSeasons) {
            const seasons = listaSeasons(item);
            if (seasons.length === 0) erro(i, `"${nome}": sem season`);

            seasons.forEach((s) => {
                if (!/^[1-9]\d*$/.test(s)) {
                    erro(i, `"${nome}": season inválida "${s}"`);
                    return;
                }
                const k = `${normalizar(nome)}|${s}`;
                if (vistos.has(k)) erro(i, `"${nome}": season ${s} repetida (já em ${onde(vistos.get(k))})`);
                else vistos.set(k, i);
            });

            if (eMixed && seasons.length < 2) aviso(i, `"${nome}": ano "Mixed" mas só tem uma season`);
            if (item.img) aviso(i, `"${nome}": o campo img é ignorado em séries e animes`);
        } else {
            const k = `${normalizar(nome)}|${item.ano}`;
            if (vistos.has(k)) erro(i, `"${nome}" (${item.ano}) repetido (já em ${onde(vistos.get(k))})`);
            else vistos.set(k, i);

            if (!item.img) {
                aviso(i, `"${nome}": sem img`);
            } else {
                if (!/\.jpg$/.test(item.img)) {
                    erro(i, `"${nome}": img tem de terminar em .jpg (${item.img})`);
                } else if (!item.img.startsWith(`${cfg.pasta}/`)) {
                    erro(i, `"${nome}": img tem de estar em ${cfg.pasta}/ (${item.img})`);
                } else {
                    const esperado = `${cfg.pasta}/${slugMedia(nome)}-${item.ano}.jpg`;
                    if (item.img !== esperado) aviso(i, `"${nome}": img diferente do padrão (esperado ${esperado})`);
                }

                if (imagens.has(item.img)) erro(i, `"${nome}": usa a mesma img de ${onde(imagens.get(item.img))}`);
                else imagens.set(item.img, i);
            }
        }
    });

    return { total: dados.length, erros, avisos };
}

let totalErros = 0;
let totalAvisos = 0;

Object.entries(CATEGORIAS).forEach(([chave, cfg]) => {
    const r = validar(chave, cfg);
    totalErros += r.erros.length;
    totalAvisos += r.avisos.length;

    console.log(`\n==================== ${cfg.nome} (${cfg.ficheiro}) - ${r.total} entradas ====================`);
    if (r.erros.length > 0) {
        console.log(`\n--- ERROS (${r.erros.length}) ---`);
        r.erros.forEach((l) => console.log(l));
    }
    if (r.avisos.length > 0) {
        console.log(`\n--- AVISOS (${r.avisos.length}) ---`);
        r.avisos.forEach((l) => console.log(l));
    }
    if (r.erros.length === 0 && r.avisos.length === 0) console.log('\nTudo certo.');
});

console.log(`\nTotal: ${totalErros} erros, ${totalAvisos} avisos.`);
process.exit(totalErros > 0 ? 1 : 0);