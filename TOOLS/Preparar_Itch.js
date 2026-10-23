/**
 * Preparar_Itch.js - prepara o zip do itch.io (sem fotos)
 * Uso (na raiz do projeto): node TOOLS/Preparar_Itch.js
 *
 * Começa em index.html e segue as ligações (páginas, CSS, JS, favicon),
 * por isso o zip só leva o que as páginas realmente usam. As capas ficam de fora
 * (o itch.io vai buscá-las ao GitHub Pages). Não altera nem apaga nada da pasta principal.
 * Cria dist_itch/ e JCArchive_itch.zip na raiz.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ, existeExato } = require('./comum');

const DIST = path.join(RAIZ, 'dist_itch');
const ZIP = path.join(RAIZ, 'JCArchive_itch.zip');
const MAX_FICHEIROS = 1000;
const MAX_FICHEIRO_MB = 200;
const MAX_TOTAL_MB = 500;
const ENDERECO_GITHUB = 'jchacker2024.github.io';

const erros = [];
const avisos = [];

const externo = (ref) => /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);

function referenciasHtml(texto) {
    const refs = [];
    const re = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(texto)) !== null) refs.push(m[1]);
    return refs;
}

function referenciasCss(texto) {
    const refs = [];
    const re = /url\(\s*["']?([^"')]+?)["']?\s*\)/gi;
    let m;
    while ((m = re.exec(texto)) !== null) refs.push(m[1]);
    return refs;
}

function resolver(deRel, ref) {
    const dir = path.posix.dirname(deRel);
    const base = ref.startsWith('/') ? ref.slice(1) : path.posix.join(dir === '.' ? '' : dir, ref);
    return path.posix.normalize(base);
}

/* 1. Descobrir o que as páginas usam */

const incluir = new Set();
const vistos = new Set();
const porVer = ['index.html'];

while (porVer.length > 0) {
    const atual = porVer.shift();
    if (vistos.has(atual)) continue;
    vistos.add(atual);

    if (atual.startsWith('..')) {
        erros.push(`Ligação que sai da pasta do projeto: ${atual}`);
        continue;
    }

    const e = existeExato(atual);
    if (!e.ok) {
        erros.push(e.motivo === 'maiusculas'
            ? `"${atual}": maiúsculas diferentes no disco (${e.real}). No itch.io isto falha`
            : `"${atual}": o ficheiro não existe`);
        continue;
    }
    incluir.add(atual);

    const ext = path.posix.extname(atual).toLowerCase();
    let refs = [];
    if (ext === '.html') refs = referenciasHtml(fs.readFileSync(path.join(RAIZ, atual), 'utf8'));
    else if (ext === '.css') refs = referenciasCss(fs.readFileSync(path.join(RAIZ, atual), 'utf8'));

    refs.forEach((bruta) => {
        const ref = bruta.split('#')[0].split('?')[0].trim();
        if (!ref || externo(ref)) return;
        porVer.push(resolver(atual, ref));
    });
}

if (!incluir.has('index.html')) erros.push('Não encontrei index.html na raiz do projeto.');

/* 2. Avisos úteis */

fs.readdirSync(RAIZ)
    .filter((n) => n.toLowerCase().endsWith('.html') && !incluir.has(n))
    .forEach((n) => avisos.push(`${n} não vai no zip (nenhuma página liga a ele)`));

const render = path.join(RAIZ, 'JS', 'Render.js');
if (fs.existsSync(render) && !fs.readFileSync(render, 'utf8').includes(ENDERECO_GITHUB)) {
    avisos.push(`JS/Render.js não tem "${ENDERECO_GITHUB}". No itch.io as capas não vão aparecer`);
}

if (erros.length > 0) {
    console.log('\n--- ERROS (o zip não foi criado) ---');
    erros.forEach((l) => console.log(l));
    process.exit(1);
}

/* 3. Copiar para dist_itch */

fs.rmSync(DIST, { recursive: true, force: true });

let totalBytes = 0;
let maiorBytes = 0;
let maiorNome = '';

incluir.forEach((rel) => {
    const origem = path.join(RAIZ, rel);
    const destino = path.join(DIST, rel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(origem, destino);

    const tamanho = fs.statSync(origem).size;
    totalBytes += tamanho;
    if (tamanho > maiorBytes) {
        maiorBytes = tamanho;
        maiorNome = rel;
    }
});

console.log(`\nFicheiros no zip (${incluir.size}):`);
[...incluir].sort().forEach((rel) => console.log(`  ${rel}`));

if (incluir.size > MAX_FICHEIROS) erros.push(`${incluir.size} ficheiros (limite do itch.io: ${MAX_FICHEIROS})`);
if (maiorBytes > MAX_FICHEIRO_MB * 1024 * 1024) erros.push(`${maiorNome} passa ${MAX_FICHEIRO_MB} MB`);
if (totalBytes > MAX_TOTAL_MB * 1024 * 1024) erros.push(`Total acima de ${MAX_TOTAL_MB} MB`);

/* 4. Criar o zip */

try {
    if (fs.existsSync(ZIP)) fs.rmSync(ZIP);
    execFileSync('tar', ['-a', '-cf', ZIP, ...fs.readdirSync(DIST)], { cwd: DIST });

    const lista = execFileSync('tar', ['-tf', ZIP], { encoding: 'utf8' }).split(/\r?\n/);
    if (lista.includes('index.html')) console.log('\nindex.html está na raiz do zip.');
    else erros.push('index.html NÃO ficou na raiz do zip');
} catch (e) {
    avisos.push(`Não consegui criar o zip automaticamente (${e.message.split('\n')[0]}). Seleciona o conteúdo de dist_itch, botão direito, Comprimir para ficheiro ZIP`);
}

if (avisos.length > 0) {
    console.log('\n--- AVISOS ---');
    avisos.forEach((l) => console.log(l));
}
if (erros.length > 0) {
    console.log('\n--- ERROS ---');
    erros.forEach((l) => console.log(l));
    process.exit(1);
}

console.log('\nPronto: JCArchive_itch.zip na raiz do projeto. No itch.io, marca "This file will be played in the browser".');