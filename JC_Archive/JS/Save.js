/**
 * JCArchive - Save Tier List as Image
 * Captura o título personalizado inserido pelo utilizador e gera a imagem em alta resolução.
 */
function guardarTierList() {
    const originalContainer = document.getElementById("capture-tier-container");
    const inputTitle = document.getElementById("tier-custom-title");

    if (!originalContainer) {
        console.error("Contentor de captura não encontrado.");
        return;
    }

    // Obter o título escrito pelo utilizador (ou usar um valor padrão se estiver vazio)
    const tituloPersonalizado = inputTitle && inputTitle.value.trim() !== "" 
        ? inputTitle.value.trim() 
        : "My Custom Tier List";

    // Criar um wrapper temporário isolado fora do ecrã
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '-9999px';
    wrapper.style.width = originalContainer.offsetWidth + 'px';
    wrapper.style.backgroundColor = '#121212';
    wrapper.style.padding = '30px';
    wrapper.style.borderRadius = '12px';
    wrapper.style.fontFamily = 'inherit';

    // Criar o cabeçalho dinâmico com o título escolhido
    const headerDiv = document.createElement('div');
    headerDiv.style.textAlign = 'center';
    headerDiv.style.marginBottom = '20px';
    headerDiv.innerHTML = `
        <h2 style="color: #ffffff; margin: 0 0 5px 0; font-size: 26px; letter-spacing: 1px;">${tituloPersonalizado}</h2>
        <p style="color: #888888; margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">JCArchive Tier List</p>
    `;
    wrapper.appendChild(headerDiv);

    // Clonar a estrutura da tier list para o wrapper
    const clonedContainer = originalContainer.cloneNode(true);
    clonedContainer.style.width = '100%';
    wrapper.appendChild(clonedContainer);

    document.body.appendChild(wrapper);

    // Renderizar a imagem com alta nitidez (scale: 3)
    html2canvas(wrapper, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#121212",
        windowWidth: wrapper.scrollWidth
    }).then(canvas => {
        document.body.removeChild(wrapper);

        // Gerar o download automático da imagem PNG
        const link = document.createElement('a');
        const nomeFicheiro = tituloPersonalizado.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
        link.download = nomeFicheiro;
        link.href = canvas.toDataURL('image/png');
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }).catch(err => {
        document.body.removeChild(wrapper);
        console.error("Erro ao gerar a imagem da Tier List:", err);
        alert("Ocorreu um erro ao tentar guardar a imagem. Tenta novamente.");
    });
}