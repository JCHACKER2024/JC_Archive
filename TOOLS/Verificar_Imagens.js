/**
 * Verificar_Imagens.js - verifica as imagens de JOGOS e FILMES (campo img dos dados)
 * Uso (na raiz do projeto): node TOOLS/Verificar_Imagens.js
 * Só lê. Para séries e animes usa o Capas_Faltam.js
 */

const { CATEGORIAS, lerDados, nomeItem, slugMedia, existeExato, listarFicheiros } = require('./comum');

let total = 0;

function secao(titulo, linhas) {
    if (linhas.length === 0) return;
    console.log(`\n--- ${titulo} (${linhas.length}) ---`);
    linhas.forEach((l) => console.log(l));
    total += linhas.length;
}

['jogos', 'filmes'].forEach((chave) => {
    const cfg = CATEGORIAS[chave];
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
    secao('FICHEIROS NA PASTA QUE NENHUM ITEM USA', orfaos);
    secao('FICHEIROS NA PASTA QUE NÃO SÃO .jpg', naoJpgNaPasta);
});

console.log(total === 0 ? '\nTudo certo.' : `\nTotal: ${total} pontos a rever.`);