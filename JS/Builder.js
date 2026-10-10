/**
 * JCArchive - Tier List Builder
 * - Drag and drop com Pointer Events (rato + touch)
 * - Item é inserido na posição onde se larga
 * - Duplo clique / duplo toque devolve o item ao pool
 * - Progresso guardado em localStorage
 */

const STORAGE_KEY = 'jcarchive-tierlist-v1';
const DRAG_THRESHOLD = 6;     // pixels antes de começar o drag
const DOUBLE_TAP_MS = 300;    // intervalo máximo do duplo clique/toque
const SCROLL_ZONE = 60;       // zona junto às margens que ativa o auto-scroll
const SCROLL_SPEED = 14;

let categoriaAtual = null;
let idCounter = 0;
let ordemCounter = 0;
let drag = null;
let ultimoTap = { item: null, time: 0 };

/* ---------------------------------------------------------------
   DADOS / INICIALIZAÇÃO
---------------------------------------------------------------- */

function obterDadosCategoria(category) {
    let rawItems = [];
    let titleText = "My Custom Tier List";

    if (category === 'jogos') {
        rawItems = (typeof dadosJogos !== 'undefined') ? dadosJogos : (typeof jogosData !== 'undefined' ? jogosData : (typeof fallbackJogos !== 'undefined' ? fallbackJogos : []));
        titleText = "Games Custom Tier List";
        if (rawItems.length === 0) console.warn("Aviso: 'dadosJogos' não foi encontrado ou está vazio!");
    } else if (category === 'filmes') {
        rawItems = (typeof dadosFilmes !== 'undefined') ? dadosFilmes : (typeof filmesData !== 'undefined' ? filmesData : (typeof fallbackFilmes !== 'undefined' ? fallbackFilmes : []));
        titleText = "Movies Custom Tier List";
    } else if (category === 'series') {
        rawItems = (typeof dadosSeries !== 'undefined') ? dadosSeries : (typeof seriesData !== 'undefined' ? seriesData : (typeof fallbackSeries !== 'undefined' ? fallbackSeries : []));
        titleText = "Series Custom Tier List";
    } else if (category === 'animes') {
        rawItems = (typeof dadosAnimes !== 'undefined') ? dadosAnimes : (typeof animesData !== 'undefined' ? animesData : (typeof fallbackAnimes !== 'undefined' ? fallbackAnimes : []));
        titleText = "Animes Custom Tier List";
    } else if (category === 'mix') {
        const j = (typeof dadosJogos !== 'undefined') ? dadosJogos : [];
        const f = (typeof dadosFilmes !== 'undefined') ? dadosFilmes : [];
        const s = (typeof dadosSeries !== 'undefined') ? dadosSeries : [];
        const a = (typeof dadosAnimes !== 'undefined') ? dadosAnimes : [];
        rawItems = [...j, ...f, ...s, ...a];
        titleText = "Custom Mix Tier List (All Media)";
    }

    return { rawItems, titleText };
}

function marcarCategoria(category) {
    const botoes = document.querySelectorAll('.setup-options .setup-btn');
    botoes.forEach(btn => btn.classList.remove('active-category'));
    botoes.forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${category}'`)) {
            btn.classList.add('active-category');
        }
    });
}

function temItensNosTiers() {
    return !!document.querySelector('.tier-items .draggable-item');
}

function initBuilder(category) {
    const pool = document.getElementById('game-pool');
    const builderSection = document.getElementById('builder-section');
    const inputTitle = document.getElementById('tier-custom-title');
    const searchInput = document.getElementById('pool-search-input');

    if (!pool || !builderSection) {
        console.error("Erro crítico: Elementos 'game-pool' ou 'builder-section' não encontrados no HTML do index.");
        return;
    }

    if (temItensNosTiers() && !confirm('Isto vai apagar a tier list atual. Continuar?')) {
        return;
    }

    marcarCategoria(category);
    categoriaAtual = category;

    if (searchInput) searchInput.value = '';

    pool.innerHTML = '';
    document.querySelectorAll('.tier-items').forEach(el => el.innerHTML = '');

    const { rawItems, titleText } = obterDadosCategoria(category);

    if (inputTitle) inputTitle.value = titleText;

    builderSection.style.display = 'block';

    // Remover duplicados por título (séries/animes têm uma entrada por season)
    const titulosVistos = new Set();
    const itemsUnicos = rawItems.filter(objItem => {
        const chave = extrairNome(objItem).toLowerCase();
        if (titulosVistos.has(chave)) return false;
        titulosVistos.add(chave);
        return true;
    });

    ordemCounter = 0;

    if (itemsUnicos.length > 0) {
        itemsUnicos.forEach(objItem => {
            criarElementoArrastavel(extrairNome(objItem), pool);
        });
    } else {
        pool.innerHTML = '<p style="color: var(--text-muted); grid-column: span 3; text-align: center; padding: 20px;">Nenhum item encontrado para esta categoria. Verifica se o ficheiro de dados foi carregado.</p>';
    }

    guardarEstado();
    builderSection.scrollIntoView({ behavior: 'smooth' });
}

function extrairNome(dadosItem) {
    if (typeof dadosItem === 'object' && dadosItem !== null) {
        return dadosItem.jogo || dadosItem.titulo || dadosItem.nome || dadosItem.name || '';
    }
    return String(dadosItem);
}

function criarElementoArrastavel(nome, containerDestino, ordem) {
    const item = document.createElement('div');
    item.className = 'draggable-item';
    item.id = 'item-' + (++idCounter);
    item.dataset.nome = nome;
    item.dataset.order = (ordem !== undefined) ? ordem : ordemCounter++;

    const strong = document.createElement('strong');
    strong.textContent = nome;
    item.appendChild(strong);

    containerDestino.appendChild(item);
    return item;
}

/* ---------------------------------------------------------------
   PESQUISA / ADICIONAR ITEM
---------------------------------------------------------------- */

function aplicarFiltro() {
    const pool = document.getElementById('game-pool');
    const searchInput = document.getElementById('pool-search-input');
    if (!pool) return;
    const termo = (searchInput ? searchInput.value : '').toLowerCase().trim();

    pool.querySelectorAll(':scope > .draggable-item').forEach(item => {
        item.style.display = item.dataset.nome.toLowerCase().includes(termo) ? 'flex' : 'none';
    });
}

function filtrarOuAdicionarItem() {
    aplicarFiltro();
}

function verificarEnterAdicao(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        adicionarItemManual();
    }
}

function adicionarItemManual() {
    const searchInput = document.getElementById('pool-search-input');
    const pool = document.getElementById('game-pool');
    if (!searchInput || !pool) return;

    const valor = searchInput.value.trim();
    if (!valor) return;

    const jaExiste = [...document.querySelectorAll('#builder-section .draggable-item')]
        .some(el => el.dataset.nome.toLowerCase() === valor.toLowerCase());

    if (!jaExiste) {
        criarElementoArrastavel(valor, pool);
    }

    searchInput.value = '';
    aplicarFiltro();
    guardarEstado();
}

/* ---------------------------------------------------------------
   DEVOLVER AO POOL / RESET
---------------------------------------------------------------- */

function devolverAoPool(item) {
    const pool = document.getElementById('game-pool');
    if (!pool || item.parentNode === pool) return;

    const ordem = Number(item.dataset.order);
    const referencia = [...pool.querySelectorAll(':scope > .draggable-item')]
        .find(el => Number(el.dataset.order) > ordem);

    pool.insertBefore(item, referencia || null);
    aplicarFiltro();
    guardarEstado();
}

function resetTierList() {
    if (!temItensNosTiers()) return;
    if (!confirm('Devolver todos os itens ao pool?')) return;

    document.querySelectorAll('.tier-items .draggable-item').forEach(devolverAoPool);
}

/* ---------------------------------------------------------------
   PERSISTÊNCIA (localStorage)
---------------------------------------------------------------- */

function lerEstado() {
    const pool = document.getElementById('game-pool');
    const inputTitle = document.getElementById('tier-custom-title');

    const itensDe = (container) =>
        [...container.querySelectorAll(':scope > .draggable-item')]
            .map(el => ({ n: el.dataset.nome, o: Number(el.dataset.order) }));

    const tiers = {};
    const labels = {};

    document.querySelectorAll('.tier-items').forEach(container => {
        const tier = container.dataset.tier;
        tiers[tier] = itensDe(container);

        const row = container.closest('.tier-row');
        const label = row ? row.querySelector('.tier-label [contenteditable]') : null;
        if (label) labels[tier] = label.textContent.trim();
    });

    return {
        category: categoriaAtual,
        title: inputTitle ? inputTitle.value : '',
        pool: pool ? itensDe(pool) : [],
        tiers,
        labels
    };
}

function guardarEstado() {
    if (!categoriaAtual) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lerEstado()));
    } catch (e) {
        console.warn('Não foi possível guardar o progresso:', e);
    }
}

function restaurarEstado() {
    let estado = null;
    try {
        estado = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
        return;
    }
    if (!estado || !estado.category) return;

    const pool = document.getElementById('game-pool');
    const builderSection = document.getElementById('builder-section');
    const inputTitle = document.getElementById('tier-custom-title');
    if (!pool || !builderSection) return;

    categoriaAtual = estado.category;
    marcarCategoria(categoriaAtual);

    if (inputTitle && estado.title) inputTitle.value = estado.title;

    pool.innerHTML = '';
    document.querySelectorAll('.tier-items').forEach(el => el.innerHTML = '');

    let maxOrdem = -1;
    const criar = (lista, container) => {
        (lista || []).forEach(({ n, o }) => {
            criarElementoArrastavel(n, container, o);
            if (o > maxOrdem) maxOrdem = o;
        });
    };

    criar(estado.pool, pool);

    Object.entries(estado.tiers || {}).forEach(([tier, lista]) => {
        const container = document.querySelector(`.tier-items[data-tier="${tier}"]`);
        if (container) criar(lista, container);
    });

    Object.entries(estado.labels || {}).forEach(([tier, texto]) => {
        const container = document.querySelector(`.tier-items[data-tier="${tier}"]`);
        const row = container ? container.closest('.tier-row') : null;
        const label = row ? row.querySelector('.tier-label [contenteditable]') : null;
        if (label && texto) label.textContent = texto;
    });

    ordemCounter = maxOrdem + 1;
    builderSection.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    restaurarEstado();

    const inputTitle = document.getElementById('tier-custom-title');
    if (inputTitle) inputTitle.addEventListener('input', guardarEstado);

    // Edição dos subtítulos dos tiers (Goat, Amazing, ...)
    document.addEventListener('input', (e) => {
        if (e.target.closest && e.target.closest('.tier-label [contenteditable]')) guardarEstado();
    });
});

/* ---------------------------------------------------------------
   INTERAÇÃO
   Rato:   arrastar e largar (Pointer Events).
   Toque:  tocar num item para o selecionar; tocar num tier, no pool
           ou noutro item para o colocar lá. O scroll funciona normal.
---------------------------------------------------------------- */

let ultimoTipo = 'mouse';
let selecionado = null;

function encontrarContainer(el) {
    if (!el) return null;
    const pool = el.closest('#game-pool');
    if (pool) return pool;
    const row = el.closest('.tier-row');
    if (row && row.closest('#builder-section')) return row.querySelector('.tier-items');
    return null;
}

// Devolve o irmão antes do qual o item deve ser inserido (null = fim)
function encontrarReferencia(container, x, y, item) {
    const irmaos = [...container.querySelectorAll(':scope > .draggable-item')]
        .filter(el => el !== item && el.offsetParent !== null);

    for (const el of irmaos) {
        const r = el.getBoundingClientRect();
        if (y < r.top) return el;
        if (y <= r.bottom && x < r.left + r.width / 2) return el;
    }
    return null;
}

/* ---------- Toque: selecionar e colocar ---------- */

function limparSelecao() {
    if (selecionado) selecionado.classList.remove('selected');
    selecionado = null;
}

function itemSelecionado() {
    if (selecionado && !document.body.contains(selecionado)) selecionado = null;
    return selecionado;
}

function selecionar(item) {
    limparSelecao();
    selecionado = item;
    item.classList.add('selected');
}

function colocarSelecionado(container) {
    const item = itemSelecionado();
    if (!item) return;
    limparSelecao();

    if (container.id === 'game-pool') {
        devolverAoPool(item);
    } else {
        container.appendChild(item);
        guardarEstado();
    }
}

function tocarItem(item) {
    const agora = Date.now();

    // Duplo toque: devolve ao pool
    if (ultimoTap.item === item && agora - ultimoTap.time < DOUBLE_TAP_MS) {
        ultimoTap = { item: null, time: 0 };
        limparSelecao();
        devolverAoPool(item);
        return;
    }
    ultimoTap = { item, time: agora };

    const atual = itemSelecionado();

    if (!atual) {
        selecionar(item);
    } else if (atual === item) {
        limparSelecao();
    } else {
        // Coloca o item selecionado antes do item tocado
        item.parentNode.insertBefore(atual, item);
        limparSelecao();
        guardarEstado();
    }
}

// Antes do Save: não deixar o item "selecionado" aparecer na imagem
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-save')) limparSelecao();
}, true);

document.addEventListener('click', (e) => {
    if (ultimoTipo !== 'touch') return;
    if (!e.target.closest('#builder-section')) return;
    if (e.target.closest('[contenteditable], input, button')) return;

    const item = e.target.closest('.draggable-item');
    if (item) {
        tocarItem(item);
        return;
    }

    const container = encontrarContainer(e.target);
    if (container) colocarSelecionado(container);
});

/* ---------- Rato: arrastar e largar ---------- */

function iniciarDrag() {
    const { item } = drag;
    const rect = item.getBoundingClientRect();

    drag.offsetX = drag.startX - rect.left;
    drag.offsetY = drag.startY - rect.top;

    const ghost = item.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.classList.add('drag-ghost');
    ghost.style.position = 'fixed';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.margin = '0';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    document.body.appendChild(ghost);

    item.classList.add('dragging');
    document.body.classList.add('is-dragging');

    drag.ghost = ghost;
    drag.ativo = true;
    drag.sobreContainer = true;
    drag.raf = requestAnimationFrame(loopScroll);

    atualizarDrag();
}

function atualizarDrag() {
    if (!drag || !drag.ativo) return;
    const { ghost, x, y, offsetX, offsetY, item } = drag;

    ghost.style.left = (x - offsetX) + 'px';
    ghost.style.top = (y - offsetY) + 'px';

    document.querySelectorAll('.drop-hover').forEach(c => c.classList.remove('drop-hover'));

    const container = encontrarContainer(document.elementFromPoint(x, y));
    drag.sobreContainer = !!container;
    if (!container) return;

    container.classList.add('drop-hover');

    const referencia = encontrarReferencia(container, x, y, item);
    const jaNaPosicao = item.parentNode === container &&
        (referencia ? item.nextElementSibling === referencia : !item.nextElementSibling);

    if (!jaNaPosicao) container.insertBefore(item, referencia);
}

function loopScroll() {
    if (!drag || !drag.ativo) return;

    let dy = 0;
    if (drag.y < SCROLL_ZONE) dy = -SCROLL_SPEED;
    else if (drag.y > window.innerHeight - SCROLL_ZONE) dy = SCROLL_SPEED;

    if (dy !== 0) {
        window.scrollBy(0, dy);
        atualizarDrag();
    }
    drag.raf = requestAnimationFrame(loopScroll);
}

function terminarDrag(cancelar) {
    if (!drag) return;
    const d = drag;
    drag = null;

    if (d.ativo) {
        cancelAnimationFrame(d.raf);
        d.ghost.remove();
        d.item.classList.remove('dragging');
        document.body.classList.remove('is-dragging');
        document.querySelectorAll('.drop-hover').forEach(c => c.classList.remove('drop-hover'));

        // Largado fora de qualquer tier/pool: volta ao sítio original
        if (cancelar || !d.sobreContainer) {
            d.origParent.insertBefore(d.item, d.origNext);
        }
        guardarEstado();
    } else if (!cancelar) {
        tratarCliqueRato(d.item);
    }
}

// Duplo clique (rato) devolve o item ao pool
function tratarCliqueRato(item) {
    const agora = Date.now();
    if (ultimoTap.item === item && agora - ultimoTap.time < DOUBLE_TAP_MS) {
        ultimoTap = { item: null, time: 0 };
        devolverAoPool(item);
    } else {
        ultimoTap = { item, time: agora };
    }
}

document.addEventListener('pointerdown', (e) => {
    ultimoTipo = e.pointerType;

    if (e.pointerType === 'touch') return;                    // toque usa selecionar/colocar
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drag) return;

    const item = e.target.closest('.draggable-item');
    if (!item || !item.closest('#builder-section')) return;

    drag = {
        item,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        ativo: false,
        origParent: item.parentNode,
        origNext: item.nextSibling,
        ghost: null,
        offsetX: 0,
        offsetY: 0,
        sobreContainer: true,
        raf: null
    };
});

window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;

    drag.x = e.clientX;
    drag.y = e.clientY;

    if (!drag.ativo) {
        const dist = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);
        if (dist < DRAG_THRESHOLD) return;
        iniciarDrag();
        return;
    }

    e.preventDefault();
    atualizarDrag();
});

window.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    terminarDrag(false);
});

window.addEventListener('pointercancel', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    terminarDrag(true);
});