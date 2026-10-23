/**
 * Capas_Faltam.js - mostra que capas de séries e animes faltam e que ficheiros têm o nome errado
 * Uso (na raiz do projeto): node TOOLS/Capas_Faltam.js
 * Para guardar a lista num ficheiro: node TOOLS/Capas_Faltam.js > lista.txt
 * Só lê. Não altera nem apaga nada. Só aceita .jpg, com maiúsculas e minúsculas exatas.
 */

const path = require('path');
const { CATEGORIAS, slug, lerDados, listaSeasons, listarFicheiros } = require('./comum');

const EXT_CERTA = 'jpg';

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

function analisar(cfg) {
    const { dados } = lerDados(cfg);

    const esperados = new Map();
    dados.forEach((item) => {
        listaSeasons(item).forEach((s) => {
            const stem = `${slug(item.titulo)}-s${s}`;
            if (!esperados.has(stem)) esperados.set(stem, { titulo: item.titulo, season: s });
        });
    });

    const ficheiros = listarFicheiros(cfg.pasta).map((n) => ({
        nome: n,
        stem: path.parse(n).name,
        ext: path.parse(n).ext.slice(1)
    }));

    const emFalta = [];
    const extErrada = [];
    let comCapa = 0;

    for (const [stem, info] of esperados) {
        if (ficheiros.some((f) => f.stem === stem && f.ext === EXT_CERTA)) {
            comCapa++;
        } else {
            const outro = ficheiros.find((f) => f.stem === stem);
            if (outro) extErrada.push({ stem, nome: outro.nome });
            else emFalta.push({ stem, info });
        }
    }

    const semDono = ficheiros.filter((f) => !esperados.has(f.stem));
    const candidatos = [...emFalta.map((x) => x.stem), ...extErrada.map((x) => x.stem)];

    const orfaos = semDono.map((f) => {
        let melhor = null;
        let melhorDist = Infinity;
        candidatos.forEach((c) => {
            const dist = distancia(f.stem.toLowerCase(), c);
            if (dist < melhorDist) {
                melhorDist = dist;
                melhor = c;
            }
        });
        const limite = Math.max(3, Math.floor(f.stem.length * 0.3));
        return { nome: f.nome, sugestao: melhorDist <= limite ? melhor : null };
    });

    return { esperados: esperados.size, comCapa, emFalta, extErrada, orfaos };
}

function mostrar(cfg, r) {
    console.log(`\n==================== ${cfg.nome} (${cfg.pasta}) ====================`);
    console.log(`Seasons nos dados: ${r.esperados} | Com capa certa: ${r.comCapa} | Em falta: ${r.emFalta.length}`);

    if (r.emFalta.length > 0) {
        console.log(`\n--- EM FALTA (${r.emFalta.length}) - cria estes ficheiros ---`);
        r.emFalta.forEach(({ stem, info }) =>
            console.log(`${stem}.${EXT_CERTA}    <- ${info.titulo}, season ${info.season}`)
        );
    }

    if (r.extErrada.length > 0) {
        console.log(`\n--- EXTENSÃO ERRADA (${r.extErrada.length}) - só se aceita .${EXT_CERTA} (minúsculas) ---`);
        r.extErrada.forEach(({ stem, nome }) => console.log(`${nome}  ->  ${stem}.${EXT_CERTA}`));
    }

    if (r.orfaos.length > 0) {
        console.log(`\n--- SEM CORRESPONDÊNCIA (${r.orfaos.length}) - nome errado, ou season que ainda não está nos dados ---`);
        r.orfaos.forEach(({ nome, sugestao }) =>
            console.log(sugestao
                ? `${nome}  ->  talvez seja ${sugestao}.${EXT_CERTA}`
                : `${nome}  ->  nenhuma sugestão (season futura?)`)
        );
    }

    if (r.emFalta.length === 0 && r.extErrada.length === 0 && r.orfaos.length === 0) {
        console.log('\nTudo certo.');
    }
}

['series', 'animes'].forEach((chave) => mostrar(CATEGORIAS[chave], analisar(CATEGORIAS[chave])));