/* RENDERIZAÇÃO DAS TIER LISTS E FILTROS */

const BASE_URL = ''; 
const EXTENSOES_CAPA = ['jpg'];

let postersLigados = false;
try {
    postersLigados = localStorage.getItem('jcarchive-posters') === 'on';
} catch (e) {}

function slugCapa(texto) {
    return String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function urlCapa(caminho) {
    if (caminho.startsWith('http')) return caminho;
    if (caminho.startsWith('/')) caminho = caminho.substring(1);
    return BASE_URL ? BASE_URL + caminho : caminho;
}

function caminhosCapaSeason(pasta, titulo, season) {
    const base = `IMG/${pasta}/${slugCapa(titulo)}-s${season}`;
    return EXTENSOES_CAPA.map(ext => `${base}.${ext}`);
}

function juntarCapa(card, caminhos, alt) {
    const img = document.createElement('img');
    let tentativa = 0;

    img.alt = alt;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => {
        tentativa++;
        if (tentativa < caminhos.length) {
            img.src = urlCapa(caminhos[tentativa]);
        } else {
            img.remove();
            card.classList.remove('has-poster');
        }
    };

    img.src = urlCapa(caminhos[0]);
    card.classList.add('has-poster');
    card.prepend(img);
}

function listaSeasons(item) {
    if (!item.season) return [];
    return String(item.season).split(',').map(s => s.trim()).filter(Boolean);
}

function renderizarTabelaMedia(dados, containerId, selectFilterId, tipoFiltroChave, pastaCapas) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let dadosAtuais = dados;

    function desenhar(dadosParaRenderizar) {
        dadosAtuais = dadosParaRenderizar;
        
        // Usamos um DocumentFragment principal para o container para evitar repinturas excessivas do browser (Lag fix)
        const fragmentContainer = document.createDocumentFragment();
        
        const tempContainer = document.createElement('div');
        tempContainer.className = container.className;
        tempContainer.classList.toggle('posters-on', postersLigados);

        if (!dadosParaRenderizar || dadosParaRenderizar.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No items found.</p>';
            return;
        }

        const ordemTiers = [
            { key: 'S+', label: 'S+', class: 'tier-splus', subtitle: 'GOAT' },
            { key: 'S',  label: 'S',  class: 'tier-s',     subtitle: 'AMAZING' },
            { key: 'A',  label: 'A',  class: 'tier-a',     subtitle: 'GOOD' },
            { key: 'B',  label: 'B',  class: 'tier-b',     subtitle: 'MID' },
            { key: 'C',  label: 'C',  class: 'tier-c',     subtitle: 'BAD' },
            { key: 'D',  label: 'D',  class: 'tier-d',     subtitle: 'TRASH' },
            { key: 'F',  label: 'F',  class: 'tier-f',     subtitle: 'DOG SHIT' }
        ];

        ordemTiers.forEach(tierInfo => {
            const itensDoTier = dadosParaRenderizar.filter(item => {
                const itemTier = item.tier ? item.tier.toUpperCase() : 'B';
                return itemTier === tierInfo.key;
            });

            const entradas = [];
            itensDoTier.forEach(item => {
                const seasons = listaSeasons(item);
                if (postersLigados && pastaCapas && seasons.length > 0) {
                    seasons.forEach(s => entradas.push({ item, season: s }));
                } else {
                    entradas.push({ item, season: null });
                }
            });

            const tierRow = document.createElement('div');
            tierRow.className = 'tier-row';

            const tierLabel = document.createElement('div');
            tierLabel.className = `tier-label ${tierInfo.class}`;
            tierLabel.innerHTML = `
                <span>${tierInfo.label}</span>
                <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; opacity: 0.9;">${tierInfo.subtitle}</span>
            `;

            const tierItems = document.createElement('div');
            tierItems.className = 'tier-items';

            if (entradas.length === 0) {
                tierItems.innerHTML = '<span style="color: var(--text-muted); font-size: 0.80rem; padding: 10px; opacity: 0.5;">-</span>';
            } else {
                // Fragmento secundário para os items do tier
                const fragmentItems = document.createDocumentFragment();

                entradas.forEach(({ item, season }) => {
                    const card = document.createElement('div');
                    card.className = 'draggable-item';

                    const nome = item.jogo || item.titulo || 'Unknown';
                    const subInfo = [];

                    if (season) {
                        subInfo.push(`Season ${season}`);
                    } else if (item.season) {
                        subInfo.push(`Season ${item.season}`);
                    } else if (item.ano && item.ano !== "Mixed") {
                        subInfo.push(item.ano);
                    }

                    const valorFiltro = item[tipoFiltroChave] || item.genero;
                    if (valorFiltro) {
                        subInfo.push(valorFiltro);
                    }

                    const subTexto = subInfo.join(' • ');

                    card.innerHTML = `<strong>${nome}</strong><span style="font-size: 0.75rem; opacity: 0.7; display: block;">${subTexto}</span>`;
                    card.title = `${nome}${subTexto ? ' - ' + subTexto : ''}`;

                    if (postersLigados) {
                        if (season && pastaCapas) {
                            juntarCapa(card, caminhosCapaSeason(pastaCapas, nome, season), nome);
                        } else if (item.img) {
                            juntarCapa(card, [item.img], nome);
                        }
                    }

                    fragmentItems.appendChild(card);
                });

                tierItems.appendChild(fragmentItems);
            }

            tierRow.appendChild(tierLabel);
            tierRow.appendChild(tierItems);
            tempContainer.appendChild(tierRow);
        });

        fragmentContainer.appendChild(tempContainer);
        container.innerHTML = '';
        container.appendChild(fragmentContainer);
    }

    desenhar(dados);

    const togglePosters = document.getElementById('toggle-posters');
    if (togglePosters) {
        togglePosters.checked = postersLigados;
        togglePosters.onchange = () => {
            postersLigados = togglePosters.checked;
            try {
                localStorage.setItem('jcarchive-posters', postersLigados ? 'on' : 'off');
            } catch (e) {}
            desenhar(dadosAtuais);
        };
    }

    if (selectFilterId) {
        const selectElement = document.getElementById(selectFilterId);
        if (selectElement) {
            selectElement.onchange = (e) => {
                const valorFiltro = e.target.value.toLowerCase();
                if (valorFiltro === 'all') {
                    desenhar(dados);
                } else {
                    const filtrados = dados.filter(item => {
                        const prop = item[tipoFiltroChave] || item.genero;
                        if (!prop) return false;
                        return String(prop)
                            .split('/')
                            .some(g => g.trim().toLowerCase() === valorFiltro);
                    });
                    desenhar(filtrados);
                }
            };
        }
    }
}