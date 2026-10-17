/**
 * JCArchive - Save Tier List as Image
 * Captura o título personalizado inserido pelo utilizador e gera a imagem em alta resolução.
 * Tiers vazios são omitidos da imagem final.
 */
function escaparHTML(texto) {
    return texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function guardarTierList() {
    const originalContainer = document.getElementById("capture-tier-container");
    const inputTitle = document.getElementById("tier-custom-title");

    if (!originalContainer) {
        console.error("Contentor de captura não encontrado.");
        return;
    }

    if (typeof html2canvas === 'undefined') {
        alert("A biblioteca html2canvas não foi carregada.");
        return;
    }

    const tituloPersonalizado = inputTitle && inputTitle.value.trim() !== ""
        ? inputTitle.value.trim()
        : "My Custom Tier List";

    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '-9999px';
    wrapper.style.width = originalContainer.offsetWidth + 'px';
    wrapper.style.backgroundColor = '#121212';
    wrapper.style.padding = '30px';
    wrapper.style.borderRadius = '12px';
    wrapper.style.fontFamily = 'inherit';

    const headerDiv = document.createElement('div');
    headerDiv.style.textAlign = 'center';
    headerDiv.style.marginBottom = '20px';
    headerDiv.innerHTML = `
        <h2 style="color: #ffffff; margin: 0 0 5px 0; font-size: 26px; letter-spacing: 1px;">${escaparHTML(tituloPersonalizado)}</h2>
        <p style="color: #888888; margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">JCArchive Tier List</p>
    `;
    wrapper.appendChild(headerDiv);

    const clonedContainer = originalContainer.cloneNode(true);
    clonedContainer.style.width = '100%';

    clonedContainer.querySelectorAll('.tier-row').forEach(row => {
        const temItens = row.querySelector('.tier-items .draggable-item');
        if (!temItens) row.remove();
    });

    if (clonedContainer.querySelectorAll('.tier-row').length === 0) {
        alert("A tier list está vazia. Arrasta pelo menos um item para um tier.");
        return;
    }

    wrapper.appendChild(clonedContainer);
    document.body.appendChild(wrapper);

    html2canvas(wrapper, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#121212",
        windowWidth: wrapper.scrollWidth
    }).then(canvas => {
        document.body.removeChild(wrapper);

        const link = document.createElement('a');
        const nomeFicheiro = tituloPersonalizado.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png';
        link.download = nomeFicheiro || 'tier-list.png';
        link.href = canvas.toDataURL('image/png');

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }).catch(err => {
        if (wrapper.parentNode) document.body.removeChild(wrapper);
        console.error("Erro ao gerar a imagem da Tier List:", err);
        alert("Ocorreu um erro ao tentar guardar a imagem. Tenta novamente.");
    });
}