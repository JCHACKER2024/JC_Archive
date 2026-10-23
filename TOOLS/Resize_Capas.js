/**
 * Resize_Capas.js - reduz as capas (300 px de largura) e converte tudo para .jpg
 *
 * Uso (na raiz do projeto):
 *   node TOOLS/Resize_Capas.js          -> reduz e converte
 *   node TOOLS/Resize_Capas.js --ver    -> só lista, não altera nada
 *
 * - .jpg com mais de 300 px de largura: reduzidos NO SÍTIO (faz cópia de IMG antes se quiseres guardar os originais).
 * - .png / .jpeg / .webp: cria um .jpg ao lado e NÃO apaga o original.
 *   Depois atualiza o campo img nos dados e apaga o original à mão.
 */

const fs = require('fs');
const path = require('path');
const { RAIZ, CATEGORIAS, LARGURA, QUALIDADE, obterSharp } = require('./comum');

const SO_VER = process.argv.includes('--ver');
const MAX_KB = 120;
const CONVERTIVEIS = ['.png', '.jpeg', '.webp'];
const kb = (bytes) => Math.round(bytes / 1024);

async function main() {
    const sharp = obterSharp();
    let reduzidas = 0;
    let jaBem = 0;
    let convertidas = 0;
    let poupado = 0;
    const naoJpg = [];
    const pesadas = [];

    for (const cfg of Object.values(CATEGORIAS)) {
        const dir = path.join(RAIZ, cfg.pasta);
        if (!fs.existsSync(dir)) {
            console.log(`Pasta não encontrada: ${cfg.pasta}`);
            continue;
        }

        for (const nome of fs.readdirSync(dir)) {
            const ficheiro = path.join(dir, nome);
            if (!fs.statSync(ficheiro).isFile()) continue;

            const rel = `${cfg.pasta}/${nome}`;
            const ext = path.extname(nome);

            if (ext === '.jpg') {
                const original = fs.readFileSync(ficheiro);
                const meta = await sharp(original).metadata();
                let tamanhoFinal = original.length;

                if (meta.width > LARGURA) {
                    if (SO_VER) {
                        pesadas.push(`${rel}  (${meta.width}px, ${kb(original.length)} kB) -> seria reduzida`);
                        continue;
                    }
                    const novo = await sharp(original)
                        .rotate()
                        .resize({ width: LARGURA })
                        .jpeg({ quality: QUALIDADE, mozjpeg: true })
                        .toBuffer();

                    if (novo.length < original.length) {
                        fs.writeFileSync(ficheiro, novo);
                        poupado += original.length - novo.length;
                        tamanhoFinal = novo.length;
                        reduzidas++;
                    } else {
                        jaBem++;
                    }
                } else {
                    jaBem++;
                }

                if (tamanhoFinal > MAX_KB * 1024) pesadas.push(`${rel}  (${kb(tamanhoFinal)} kB, ainda pesada)`);
                continue;
            }

            if (ext.toLowerCase() === '.jpg') {
                naoJpg.push(`${rel}  -> muda a extensão para .jpg (minúsculas)`);
                continue;
            }

            if (CONVERTIVEIS.includes(ext.toLowerCase())) {
                const destinoNome = `${path.parse(nome).name}.jpg`;
                const destino = path.join(dir, destinoNome);

                if (fs.existsSync(destino)) {
                    naoJpg.push(`${rel}  -> já existe ${destinoNome}; apaga este ficheiro se já não o queres`);
                } else if (SO_VER) {
                    naoJpg.push(`${rel}  -> seria convertido para ${destinoNome}`);
                } else {
                    const jpg = await sharp(fs.readFileSync(ficheiro))
                        .rotate()
                        .flatten({ background: '#ffffff' })
                        .resize({ width: LARGURA, withoutEnlargement: true })
                        .jpeg({ quality: QUALIDADE, mozjpeg: true })
                        .toBuffer();
                    fs.writeFileSync(destino, jpg, { flag: 'wx' });
                    convertidas++;
                    naoJpg.push(`${rel}  -> criado ${destinoNome}. Atualiza o img nos dados e apaga o original`);
                }
                continue;
            }

            naoJpg.push(`${rel}  -> formato não suportado (só .jpg)`);
        }
    }

    if (naoJpg.length > 0) {
        console.log(`\n--- NÃO SÃO .jpg (${naoJpg.length}) ---`);
        naoJpg.forEach((l) => console.log(l));
    }
    if (pesadas.length > 0) {
        console.log(`\n--- A VER (${pesadas.length}) ---`);
        pesadas.forEach((l) => console.log(l));
    }

    console.log(`\n${SO_VER ? '(só a ver, nada foi alterado) ' : ''}${reduzidas} reduzidas, ${jaBem} já estavam bem, ${convertidas} convertidas, ${(poupado / 1024 / 1024).toFixed(1)} MB poupados.`);
}

main().catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
});