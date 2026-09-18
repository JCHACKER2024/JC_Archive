/**
 * Renderiza dinamicamente as tier lists e gere os filtros por categoria
 */
function renderizarTabelaMedia(dados, containerId, selectFilterId, tipoFiltroChave) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Função interna que desenha os dados (filtrados ou totais)
    function desenhar(dadosParaRenderizar) {
        container.innerHTML = '';

        if (!dadosParaRenderizar || dadosParaRenderizar.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Nenhum item encontrado.</p>';
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

            if (itensDoTier.length === 0) {
                tierItems.innerHTML = '<span style="color: var(--text-muted); font-size: 0.80rem; padding: 10px; opacity: 0.5;">-</span>';
            } else {
                itensDoTier.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'draggable-item';

                    const nome = item.jogo || item.titulo || 'Desconhecido';
                    let subInfo = [];

                    // Se tiver seasons, adiciona. Se não, usa o ano (evitando o "Mixed")
                    if (item.season) {
                        subInfo.push(`Season ${item.season}`);
                    } else if (item.ano && item.ano !== "Mixed") {
                        subInfo.push(item.ano);
                    }

                    // Adiciona o género ou o filtro correspondente
                    const valorFiltro = item[tipoFiltroChave] || item.genero;
                    if (valorFiltro) {
                        subInfo.push(valorFiltro);
                    }

                    const subTexto = subInfo.join(' • ');

                    card.innerHTML = `<strong>${nome}</strong><span style="font-size: 0.75rem; opacity: 0.7; display: block;">${subTexto}</span>`;
                    card.title = `${nome}${subTexto ? ' - ' + subTexto : ''}`;

                    tierItems.appendChild(card);
                });
            }

            tierRow.appendChild(tierLabel);
            tierRow.appendChild(tierItems);
            container.appendChild(tierRow);
        });
    }

    // Desenhar inicialmente todos os dados
    desenhar(dados);

    // Configurar o evento do filtro se o ID do select existir na página
    if (selectFilterId) {
        const selectElement = document.getElementById(selectFilterId);
        if (selectElement) {
            selectElement.onchange = (e) => {
                const valorFiltro = e.target.value;
                if (valorFiltro === 'all') {
                    desenhar(dados);
                } else {
                    const filtrados = dados.filter(item => {
                        const prop = item[tipoFiltroChave] || item.genero;
                        return prop && prop.toLowerCase() === valorFiltro.toLowerCase();
                    });
                    desenhar(filtrados);
                }
            };
        }
    }
}