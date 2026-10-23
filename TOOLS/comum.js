/**
 * comum.js - funções partilhadas pelos scripts da pasta TOOLS.
 * Não se corre sozinho.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const TOOLS_DIR = __dirname;
const RAIZ = path.join(__dirname, '..');

const LARGURA = 300;
const QUALIDADE = 80;

const CATEGORIAS = {
    jogos:  { ficheiro: 'JS/Data_Jogos.js',  variavel: 'dadosJogos',  pasta: 'IMG/Jogos',  nome: 'JOGOS' },
    filmes: { ficheiro: 'JS/Data_Filmes.js', variavel: 'dadosFilmes', pasta: 'IMG/Filmes', nome: 'FILMES' },
    series: { ficheiro: 'JS/Data_Series.js', variavel: 'dadosSeries', pasta: 'IMG/Series', nome: 'SÉRIES' },
    animes: { ficheiro: 'JS/Data_Animes.js', variavel: 'dadosAnimes', pasta: 'IMG/Animes', nome: 'ANIMES' }
};

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Séries e animes: mesma regra do Render.js (slugCapa)
function slug(texto) {
    return String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Jogos e filmes: o "&" vira "and" (ex.: Fast & Furious -> fast-and-furious)
function slugMedia(texto) {
    return slug(String(texto).replace(/&/g, ' and '));
}

function normalizar(texto) {
    return String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function semExtensao(nome) {
    return nome.replace(/\.[^.]+$/, '');
}

function nomeItem(item) {
    return item.jogo || item.titulo || '';
}

function listaSeasons(item) {
    if (!item.season) return [];
    return String(item.season).split(',').map((s) => s.trim()).filter(Boolean);
}

// Lê um Data_*.js e devolve { dados, linhas } (linhas = nº da linha de cada entrada)
function lerDados(cfg) {
    const codigo = fs.readFileSync(path.join(RAIZ, cfg.ficheiro), 'utf8');
    const ctx = {};
    vm.runInNewContext(codigo + `\n;__resultado = ${cfg.variavel};`, ctx);
    const dados = ctx.__resultado;

    const linhas = [];
    codigo.split(/\r?\n/).forEach((texto, i) => {
        if (/^\s*\{\s*tier\s*:/.test(texto)) linhas.push(i + 1);
    });

    return { dados, linhas: linhas.length === dados.length ? linhas : null };
}

function listarFicheiros(pastaRel) {
    const dir = path.join(RAIZ, pastaRel);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isFile());
}

// Verifica o caminho com as maiúsculas exatas (o Windows ignora, o itch.io e o GitHub não)
function existeExato(caminhoRel) {
    let atual = RAIZ;
    for (const parte of caminhoRel.split('/').filter(Boolean)) {
        let nomes;
        try {
            nomes = fs.readdirSync(atual);
        } catch (e) {
            return { ok: false, motivo: 'falta' };
        }
        if (nomes.includes(parte)) {
            atual = path.join(atual, parte);
            continue;
        }
        const alt = nomes.find((n) => n.toLowerCase() === parte.toLowerCase());
        return alt ? { ok: false, motivo: 'maiusculas', real: alt } : { ok: false, motivo: 'falta' };
    }
    return { ok: true };
}

// 'existe' | 'parecido' (mesmo nome com outra extensão ou maiúsculas) | 'falta'
function estadoImagem(caminhoRel) {
    const dirRel = path.posix.dirname(caminhoRel);
    const nome = path.posix.basename(caminhoRel);
    const stem = semExtensao(nome).toLowerCase();
    const nomes = listarFicheiros(dirRel);

    if (nomes.includes(nome)) return { estado: 'existe' };
    const parecido = nomes.find((n) => semExtensao(n).toLowerCase() === stem);
    return parecido ? { estado: 'parecido', parecido } : { estado: 'falta' };
}

// Carrega o sharp; se não existir, instala-o dentro de TOOLS (só acontece uma vez)
function obterSharp() {
    try {
        return require('sharp');
    } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }

    console.log('O sharp ainda não está instalado. A instalar dentro de TOOLS (só acontece uma vez)...');
    const pacote = path.join(TOOLS_DIR, 'package.json');
    if (!fs.existsSync(pacote)) {
        fs.writeFileSync(pacote, JSON.stringify({ name: 'jcarchive-tools', private: true }, null, 2) + '\n');
    }

    try {
        execSync('npm install sharp', { cwd: TOOLS_DIR, stdio: 'inherit' });
    } catch (e) {
        console.error('\nNão consegui instalar o sharp (precisas de internet e do Node/npm instalado).');
        process.exit(1);
    }
    return require('sharp');
}

// Converte para .jpg (300 px de largura) e grava SÓ SE o ficheiro não existir
async function guardarCapa(buffer, destinoRel) {
    const sharp = obterSharp();
    const destino = path.join(RAIZ, destinoRel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });

    const jpg = await sharp(buffer)
        .rotate()
        .flatten({ background: '#ffffff' })
        .resize({ width: LARGURA, withoutEnlargement: true })
        .jpeg({ quality: QUALIDADE, mozjpeg: true })
        .toBuffer();

    fs.writeFileSync(destino, jpg, { flag: 'wx' });
}

module.exports = {
    TOOLS_DIR, RAIZ, LARGURA, QUALIDADE, CATEGORIAS,
    esperar, slug, slugMedia, normalizar, semExtensao, nomeItem, listaSeasons,
    lerDados, listarFicheiros, existeExato, estadoImagem, obterSharp, guardarCapa
};