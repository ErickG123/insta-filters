const clampByte = v => Math.max(0, Math.min(255, Math.round(v)));
const toBits = v => (v >>> 0).toString(2).padStart(8, '0');
const mix = (a, b, t) => a * (1 - t) + b * t;

function applyColorMatrix([r, g, b], m) {
    const nr = m[0] * r + m[1] * g + m[2] * b + m[3];
    const ng = m[4] * r + m[5] * g + m[6] * b + m[7];
    const nb = m[8] * r + m[9] * g + m[10] * b + m[11];
    return [nr, ng, nb];
}

function applySaturationContrast(r, g, b, sat, con) {
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const sr = gray + (r - gray) * sat;
    const sg = gray + (g - gray) * sat;
    const sb = gray + (b - gray) * sat;
    const cr = (sr - 128) * con + 128;
    const cg = (sg - 128) * con + 128;
    const cb = (sb - 128) * con + 128;
    return [cr, cg, cb];
}

const FILTERS = [
    { id: 'original', name: 'Original', apply: (r, g, b) => [r, g, b] },
    { id: 'aden', name: 'Aden', apply: (r, g, b) => applyColorMatrix([r, g, b], [1.05, 0, 0, -10, 0, 0.95, 0, -6, 0, 0, 0.95, -6]) },
    { id: 'clarendon', name: 'Clarendon', apply: (r, g, b) => applyColorMatrix([r, g, b], [1.15, 0, 0, -20, 0, 1.05, 0, -10, 0, 0, 1.05, -5]) },
    { id: 'crema', name: 'Crema', apply: (r, g, b) => applyColorMatrix([r, g, b], [0.98, 0, 0, 8, 0, 0.95, 0, 6, 0, 0, 0.9, 10]) },
    { id: 'gingham', name: 'Gingham', apply: (r, g, b) => applyColorMatrix([r, g, b], [0.9, 0, 0, 12, 0, 0.92, 0, 10, 0, 0, 0.92, 8]) },
    { id: 'juno', name: 'Juno', apply: (r, g, b) => applyColorMatrix([r, g, b], [1.06, 0, 0, -8, 0, 1.02, 0, -4, 0, 0, 0.9, -2]) },
    { id: 'lark', name: 'Lark', apply: (r, g, b) => applyColorMatrix([r, g, b], [1.06, 0, 0, -6, 0, 1.02, 0, -4, 0, 0, 0.95, -3]) },
    { id: 'ludwig', name: 'Ludwig', apply: (r, g, b) => applyColorMatrix([r, g, b], [1.08, 0, 0, -12, 0, 0.98, 0, 2, 0, 0, 0.92, 8]) },
    { id: 'moon', name: 'Moon', apply: (r, g, b) => { const gray = 0.299 * r + 0.587 * g + 0.114 * b; return [gray, gray, gray]; } },
    { id: 'perpetua', name: 'Perpetua', apply: (r, g, b) => applyColorMatrix([r, g, b], [0.98, 0, 0, 6, 0, 1.02, 0, -4, 0, 0, 0.96, -2]) },
    { id: 'reyes', name: 'Reyes', apply: (r, g, b) => applyColorMatrix([r, g, b], [0.95, 0, 0, 12, 0, 0.95, 0, 10, 0, 0, 0.9, 10]) },
    { id: 'slumber', name: 'Slumber', apply: (r, g, b) => applyColorMatrix([r, g, b], [0.9, 0, 0, 18, 0, 0.95, 0, 12, 0, 0, 0.9, 14]) }
];

const fileInput = document.getElementById('fileInput');
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const filtersGrid = document.getElementById('filtersGrid');
const filtersList = document.getElementById('filtersList');
const genThumbsBtn = document.getElementById('genThumbsBtn');
const downloadResultBtn = document.getElementById('downloadResultBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const strengthRange = document.getElementById('strength');
const satRange = document.getElementById('saturation');
const conRange = document.getElementById('contrast');
const strengthVal = document.getElementById('strengthVal');
const satVal = document.getElementById('satVal');
const conVal = document.getElementById('conVal');
const showCalc = document.getElementById('showCalc');
const pixelPanel = document.getElementById('pixelPanel');
const posText = document.getElementById('posText');
const origRGB = document.getElementById('origRGB');
const origBits = document.getElementById('origBits');
const afterFilter = document.getElementById('afterFilter');
const afterSatCon = document.getElementById('afterSatCon');
const afterSatConBits = document.getElementById('afterSatConBits');
const finalRGB = document.getElementById('finalRGB');
const finalBits = document.getElementById('finalBits');

let originalImage = null;
let originalImageData = null;
let currentFilterId = 'original';
let strength = parseFloat(strengthRange.value);
let saturation = parseFloat(satRange.value);
let contrast = parseFloat(conRange.value);

function buildFiltersUI() {
    filtersList.innerHTML = '';
    FILTERS.forEach(f => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'text-left px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-100';
        btn.textContent = f.name;
        btn.onclick = () => { currentFilterId = f.id; render(); highlightActive(); };
        filtersList.appendChild(btn);
    });

    filtersGrid.innerHTML = '';
    FILTERS.forEach(f => {
        const wrap = document.createElement('div');
        wrap.className = 'p-2 bg-slate-900 rounded-lg border border-slate-800 flex flex-col items-center';
        wrap.innerHTML = `
           <div class="text-xs text-slate-300 mb-2">${f.name}</div>
           <img class="thumb-img" data-filter="${f.id}" src="" alt="${f.name}" />
         `;
        wrap.onclick = () => { currentFilterId = f.id; render(); highlightActive(); };
        filtersGrid.appendChild(wrap);
    });
}

function highlightActive() {
    Array.from(filtersList.children).forEach(btn => {
        btn.classList.toggle('ring-2', btn.textContent === getFilter(currentFilterId).name);
        btn.classList.toggle('ring-cyan-400', btn.textContent === getFilter(currentFilterId).name);
    });

    Array.from(filtersGrid.children).forEach(wrap => {
        const name = wrap.querySelector('div').textContent;
        wrap.classList.toggle('ring-2', name === getFilter(currentFilterId).name);
        wrap.classList.toggle('ring-cyan-400', name === getFilter(currentFilterId).name);
    });
}

function getFilter(id) {
    return FILTERS.find(f => f.id === id) || FILTERS[0];
}

fileInput.addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
        originalImage = img;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        generateThumbs();
        render();
    };
    img.src = url;
});

resetBtn.addEventListener('click', () => {
    currentFilterId = 'original';
    strengthRange.value = '1';
    satRange.value = '1';
    conRange.value = '1';
    strength = 1; saturation = 1; contrast = 1;
    strengthVal.textContent = '100%';
    satVal.textContent = '1.00';
    conVal.textContent = '1.00';
    render();
    highlightActive();
});

downloadBtn.addEventListener('click', () => {
    if (!originalImage) return alert('Faça upload de uma imagem primeiro');
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'filtered.png';
    a.click();
});

downloadResultBtn.addEventListener('click', () => downloadBtn.click());

strengthRange.addEventListener('input', e => {
    strength = parseFloat(e.target.value);
    strengthVal.textContent = Math.round(strength * 100) + '%';
    render();
});
satRange.addEventListener('input', e => {
    saturation = parseFloat(e.target.value);
    satVal.textContent = saturation.toFixed(2);
    render();
});
conRange.addEventListener('input', e => {
    contrast = parseFloat(e.target.value);
    conVal.textContent = contrast.toFixed(2);
    render();
});

function render() {
    if (!originalImageData) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(originalImageData, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const filter = getFilter(currentFilterId);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        let [fr, fg, fb] = filter.apply(r, g, b);

        [fr, fg, fb] = applySaturationContrast(fr, fg, fb, saturation, contrast);
        data[i] = clampByte(mix(r, fr, strength));
        data[i + 1] = clampByte(mix(g, fg, strength));
        data[i + 2] = clampByte(mix(b, fb, strength));
    }
    ctx.putImageData(imageData, 0, 0);

    highlightActive();
}

function generateThumbs() {
    if (!originalImage) return;
    const w = 120;
    const h = Math.round(originalImage.height / originalImage.width * w);
    const tcanvas = document.createElement('canvas');
    tcanvas.width = w; tcanvas.height = h;
    const tctx = tcanvas.getContext('2d');
    tctx.drawImage(originalImage, 0, 0, w, h);
    const base = tctx.getImageData(0, 0, w, h);

    FILTERS.forEach((f) => {
        const out = tctx.createImageData(w, h);
        for (let i = 0; i < base.data.length; i += 4) {
            const r = base.data[i], g = base.data[i + 1], b = base.data[i + 2];
            let [nr, ng, nb] = f.apply(r, g, b);
            [nr, ng, nb] = applySaturationContrast(nr, ng, nb, 1, 1);
            out.data[i] = clampByte(nr);
            out.data[i + 1] = clampByte(ng);
            out.data[i + 2] = clampByte(nb);
            out.data[i + 3] = base.data[i + 3];
        }
        tctx.putImageData(out, 0, 0);
        const url = tcanvas.toDataURL();
        const imgEl = document.querySelector('.thumb-img[data-filter="' + f.id + '"]');
        if (imgEl) imgEl.src = url;
        tctx.drawImage(originalImage, 0, 0, w, h);
    });
}

genThumbsBtn.addEventListener('click', generateThumbs);

let rafPending = false;
let pendingPos = null;

canvas.addEventListener('mousemove', (ev) => {
    if (!originalImageData) return;
    if (!showCalc.checked) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((ev.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((ev.clientY - rect.top) * (canvas.height / rect.height));
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
        pendingPos = null;
        posText.textContent = 'fora da imagem';
        origRGB.textContent = '—';
        origBits.textContent = '—';
        afterFilter.textContent = '—';
        afterSatCon.textContent = '—';
        afterSatConBits.textContent = '—';
        finalRGB.textContent = '—';
        finalBits.textContent = '—';
        return;
    }

    pendingPos = { x, y };
    if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(processMouse);
    }
});

canvas.addEventListener('mouseleave', () => {
    posText.textContent = '—';
    origRGB.textContent = '—';
    origBits.textContent = '—';
    afterFilter.textContent = '—';
    afterSatCon.textContent = '—';
    afterSatConBits.textContent = '—';
    finalRGB.textContent = '—';
    finalBits.textContent = '—';
});

function processMouse() {
    rafPending = false;
    if (!pendingPos || !originalImageData) return;
    const { x, y } = pendingPos;
    const w = originalImageData.width;
    const idx = (y * w + x) * 4;
    const r0 = originalImageData.data[idx + 0];
    const g0 = originalImageData.data[idx + 1];
    const b0 = originalImageData.data[idx + 2];
    const a0 = originalImageData.data[idx + 3];

    const filter = getFilter(currentFilterId);
    const [f1r, f1g, f1b] = filter.apply(r0, g0, b0);
    const [f2r, f2g, f2b] = applySaturationContrast(f1r, f1g, f1b, saturation, contrast);
    const blendedR = mix(r0, f2r, strength);
    const blendedG = mix(g0, f2g, strength);
    const blendedB = mix(b0, f2b, strength);
    const finalR = clampByte(blendedR);
    const finalG = clampByte(blendedG);
    const finalB = clampByte(blendedB);

    posText.textContent = `(${x}, ${y})`;
    origRGB.innerHTML = `<span class="text-slate-200 font-medium">R:</span> ${r0} &nbsp;&nbsp; <span class="text-slate-200 font-medium">G:</span> ${g0} &nbsp;&nbsp; <span class="text-slate-200 font-medium">B:</span> ${b0}`;
    origBits.textContent = `bits: R ${toBits(r0)}  •  G ${toBits(g0)}  •  B ${toBits(b0)}  •  A ${a0}`;

    afterFilter.textContent = `${roundIfNeeded(f1r)} , ${roundIfNeeded(f1g)} , ${roundIfNeeded(f1b)} (valores FLOAT antes de sat/contrast)`;
    afterSatCon.textContent = `${roundIfNeeded(f2r)} , ${roundIfNeeded(f2g)} , ${roundIfNeeded(f2b)} (após saturação/contraste)`;
    afterSatConBits.textContent = `→ (floats)`;

    finalRGB.innerHTML = `<span class="text-emerald-300 font-semibold">${finalR}</span> , <span class="text-emerald-300 font-semibold">${finalG}</span> , <span class="text-emerald-300 font-semibold">${finalB}</span>`;
    finalBits.textContent = `bits finais: R ${toBits(finalR)}  •  G ${toBits(finalG)}  •  B ${toBits(finalB)}`;
}

function roundIfNeeded(v) {
    if (Math.abs(v - Math.round(v)) < 0.005) return Math.round(v);
    return v.toFixed(2);
}

(function init() {
    buildFiltersUI();
    highlightActive();
})();
