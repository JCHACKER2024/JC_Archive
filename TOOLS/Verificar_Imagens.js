/**
 * Verificar_Imagens.js - verifica as imagens de JOGOS, FILMES, SÉRIES e ANIMES
 * Uso (na raiz do projeto): node TOOLS/Verificar_Imagens.js
 * Para guardar a lista num ficheiro: node TOOLS/Verificar_Imagens.js > lista.txt
 * Só lê. Não altera nem apaga nada. Só aceita .jpg, com maiúsculas e minúsculas exatas.
 *
 * Jogos e filmes: usa o campo img dos dados.
 * Séries e animes: o nome da capa é título + season (ex.: attack-on-titan-s3.jpg).
 */

const path = require('path');
const {
    CATEGORIAS, slug, slugMedia, nomeItem, listaSeasons,
    lerDados, existeExato, listarFicheiros
} = require('./comum');

const EXT_CERTA = 'jpg';
let total = 0; // pontos a rever
let info = 0;  // só informação (ficheiros sem dono)

function secao(titulo, linhas, conta = true) {
    if (linhas.length === 0) return;
    console.log(`\n--- ${titulo} (${linhas.length}) ---`);
    linhas.forEach((l) => console.log(l));
    if (conta) total += linhas.length;
    else info += linhas.length;
}

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

/* JOGOS E FILMES: campo img */

function verificarComImg(cfg) {
    const { dados } = lerDados(cfg);

    const semImg = [];
    const falta = [];
    const maiusculas = [];
    const naoJpg = [];
    const duplicadas = [];
    const usadas = new Map();

    dados.forEach((item) => {
        const nome = nomeItem(item);

        if (!item.img) {
            semImg.push(`${nome} (${item.ano})  -> sugestão: ${cfg.pasta}/${slugMedia(nome)}-${item.ano}.jpg`);
            return;
        }

        if (!usadas.has(item.img)) usadas.set(item.img, []);
        usadas.get(item.img).push(nome);

        if (!/\.jpg$/.test(item.img)) naoJpg.push(`${nome}: ${item.img}`);

        const e = existeExato(item.img);
        if (!e.ok) {
            if (e.motivo === 'maiusculas') maiusculas.push(`${nome}: ${item.img}  (no disco chama-se "${e.real}")`);
            else falta.push(`${nome}: ${item.img}`);
        }
    });

    usadas.forEach((nomes, img) => {
        if (nomes.length > 1) duplicadas.push(`${img}  <- ${nomes.join(' | ')}`);
    });

    const ficheiros = listarFicheiros(cfg.pasta);
    const usadosNaPasta = new Set(
        [...usadas.keys()].filter((i) => i.startsWith(`${cfg.pasta}/`)).map((i) => i.slice(cfg.pasta.length + 1))
    );
    const orfaos = ficheiros.filter((f) => !usadosNaPasta.has(f));
    const naoJpgNaPasta = ficheiros.filter((f) => !/\.jpg$/.test(f));

    console.log(`\n==================== ${cfg.nome} (${cfg.pasta}) ====================`);
    console.log(`Itens: ${dados.length} | Ficheiros na pasta: ${ficheiros.length}`);

    secao('IMG NÃO EXISTE NO DISCO - cria ou corrige o nome', falta);
    secao('MAIÚSCULAS DIFERENTES - funciona no Windows mas falha online', maiusculas);
    secao('SEM CAMPO img NOS DADOS', semImg);
    secao('img QUE NÃO TERMINA EM .jpg', naoJpg);
    secao('MESMA IMAGEM USADA EM VÁRIOS ITENS', duplicadas);
    secao('FICHEIROS NA PASTA QUE NÃO SÃO .jpg', naoJpgNaPasta);
    secao('FICHEIROS SEM DONO (nenhum item os usa; só informação)', orfaos, false);
}

/* SÉRIES E ANIMES: título + season */

function verificarPorSeason(cfg) {
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

    for (const [stem, i] of esperados) {
        if (ficheiros.some((f) => f.stem === stem && f.ext === EXT_CERTA)) continue;
        const outro = ficheiros.find((f) => f.stem === stem);
        if (outro) extErrada.push({ stem, nome: outro.nome });
        else emFalta.push({ stem, titulo: i.titulo, season: i.season });
    }

    const candidatos = [...emFalta.map((x) => x.stem), ...extErrada.map((x) => x.stem)];
    const semDono = ficheiros.filter((f) => !esperados.has(f.stem)).map((f) => {
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
        return melhorDist <= limite
            ? `${f.nome}  ->  talvez seja ${melhor}.${EXT_CERTA}`
            : `${f.nome}  ->  nenhuma sugestão (season futura?)`;
    });

    console.log(`\n==================== ${cfg.nome} (${cfg.pasta}) ====================`);
    console.log(`Seasons nos dados: ${esperados.size} | Ficheiros na pasta: ${ficheiros.length}`);

    secao(
        'EM FALTA - cria estes ficheiros',
        emFalta.map(({ stem, titulo, season }) => `${stem}.${EXT_CERTA}    <- ${titulo}, season ${season}`)
    );
    secao(
        `EXTENSÃO ERRADA - só se aceita .${EXT_CERTA} (minúsculas)`,
        extErrada.map(({ stem, nome }) => `${nome}  ->  ${stem}.${EXT_CERTA}`)
    );
    secao('FICHEIROS SEM DONO (nome errado ou season que ainda não está nos dados; só informação)', semDono, false);
}

/* MAIN */

verificarComImg(CATEGORIAS.jogos);
verificarComImg(CATEGORIAS.filmes);
verificarPorSeason(CATEGORIAS.series);
verificarPorSeason(CATEGORIAS.animes);

console.log(total === 0 ? '\nTudo certo.' : `\nTotal: ${total} pontos a rever.`);
if (info > 0) console.log(`(${info} ficheiros sem dono: só informação, podem ser itens ou seasons futuras.)`);
process.exitCode = total > 0 ? 1 : 0;