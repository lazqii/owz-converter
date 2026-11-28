document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const modeImageBtn = document.getElementById('mode-image-btn');
    const modePdfBtn = document.getElementById('mode-pdf-btn');
    const uploadTitle = document.getElementById('upload-title');
    const uploadFormatsInfo = document.getElementById('upload-formats-info');

    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const previewGallery = document.getElementById('preview-gallery');
    const originalSize = document.getElementById('original-size');
    const originalDimensions = document.getElementById('original-dimensions');
    const resetBtn = document.getElementById('reset-btn');

    const imageControls = document.getElementById('image-controls');
    const formatSelect = document.getElementById('format-select');
    const qualityGroup = document.getElementById('quality-group');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');

    const pdfControls = document.getElementById('pdf-controls');
    const pdfActionSelect = document.getElementById('pdf-action-select');
    const pdfRangeGroup = document.getElementById('pdf-range-group');
    const pdfRangeInput = document.getElementById('pdf-range-input');

    const convertBtn = document.getElementById('convert-btn');
    const downloadBtn = document.getElementById('download-btn');

    // State
    let currentMode = 'image'; // 'image' | 'pdf'
    let currentFiles = []; // Array of { file, image, originalName }
    let pdfToolFiles = []; // Array of { file, arrayBuffer, pageCount, originalName }
    let convertedBlobs = []; // Array of { blob, newFileName }
    let currentObjectUrls = []; // Array of URLs for cleanup

    // Initialization
    function init() {
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        setupEventListeners();
    }

    function setupEventListeners() {
        // Drag and Drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
            }
        });

        // File Input
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
            }
        });

        // Mode Toggle
        modeImageBtn.addEventListener('click', () => switchMode('image'));
        modePdfBtn.addEventListener('click', () => switchMode('pdf'));

        // UI Controls
        resetBtn.addEventListener('click', resetWorkspace);

        formatSelect.addEventListener('change', () => {
            // Hide quality slider for lossless formats (PNG, SVG)
            if (formatSelect.value === 'image/png' || formatSelect.value === 'image/svg+xml') {
                qualityGroup.classList.add('hidden');
            } else {
                qualityGroup.classList.remove('hidden');
            }
            hideDownloadBtn();
        });

        qualitySlider.addEventListener('input', (e) => {
            qualityValue.textContent = `${e.target.value}%`;
            hideDownloadBtn();
        });

        pdfActionSelect.addEventListener('change', () => {
            if (pdfActionSelect.value === 'split') {
                pdfRangeGroup.classList.remove('hidden');
            } else {
                pdfRangeGroup.classList.add('hidden');
            }
            hideDownloadBtn();
        });

        pdfRangeInput.addEventListener('input', hideDownloadBtn);

        // Actions
        convertBtn.addEventListener('click', () => {
            if (currentMode === 'pdf') {
                processPdfTools();
            } else {
                convertImages();
            }
        });
        downloadBtn.addEventListener('click', downloadConvertedImages);
    }

    function switchMode(mode) {
        if (currentMode === mode) return;
        currentMode = mode;

        if (mode === 'pdf') {
            modePdfBtn.classList.add('active');
            modeImageBtn.classList.remove('active');
            fileInput.setAttribute('accept', 'application/pdf');
            uploadTitle.textContent = 'Drag & Drop your PDF files here';
            uploadFormatsInfo.textContent = 'Supports PDF for Merge & Split (Max 10 PDF files)';
            imageControls.classList.add('hidden');
            pdfControls.classList.remove('hidden');
        } else {
            modeImageBtn.classList.add('active');
            modePdfBtn.classList.remove('active');
            fileInput.setAttribute('accept', 'image/jpeg, image/png, image/webp, image/svg+xml, application/pdf');
            uploadTitle.textContent = 'Drag & Drop your image or PDF here';
            uploadFormatsInfo.textContent = 'Supports JPG, PNG, WEBP, SVG, PDF (Max 10 files / 10 PDF pages)';
            pdfControls.classList.add('hidden');
            imageControls.classList.remove('hidden');
        }

        resetWorkspace();
    }

    // Handlers
    async function handleFiles(filesList) {
        const newFiles = Array.from(filesList);

        if (currentMode === 'pdf') {
            if (pdfToolFiles.length + newFiles.length > 10) {
                alert('Maksimal 10 file PDF yang dapat diproses sekaligus.');
                fileInput.value = '';
                return;
            }

            let hasInvalid = false;
            for (const file of newFiles) {
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                if (!isPdf) {
                    hasInvalid = true;
                    continue;
                }
                await processPdfToolFile(file);
            }

            if (hasInvalid && pdfToolFiles.length === 0) {
                alert('Mode PDF Tools hanya menerima file PDF.');
            }

            if (pdfToolFiles.length > 0) {
                uploadArea.classList.add('hidden');
                workspace.classList.remove('hidden');
                updateStats();
                hideDownloadBtn();
            }

            fileInput.value = '';
            return;
        }

        if (currentFiles.length + newFiles.length > 10) {
            alert('Maksimal 10 file/halaman yang dapat diproses sekaligus.');
            fileInput.value = '';
            return;
        }

        for (const file of newFiles) {
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
            const isSvgByName = file.name.toLowerCase().endsWith('.svg');

            if (isPdf) {
                await processPdfFile(file);
            } else if (validTypes.includes(file.type) || isSvgByName) {
                if (currentFiles.length >= 10) {
                    alert('Maksimal 10 gambar/halaman yang dapat diproses sekaligus.');
                    break;
                }
                await processImageFile(file);
            }
        }

        if (currentFiles.length > 0) {
            uploadArea.classList.add('hidden');
            workspace.classList.remove('hidden');
            updateStats();
            hideDownloadBtn();
        }

        fileInput.value = '';
    }

    function processImageFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
                    currentFiles.push({
                        file,
                        image: img,
                        originalName,
                        rawDataUrl: e.target.result,
                        displaySize: file.size
                    });

                    appendPreviewItem(e.target.result, originalName, file.name);
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = e.target.result;
            };
            reader.onerror = () => resolve();
            reader.readAsDataURL(file);
        });
    }

    async function processPdfFile(file) {
        if (typeof pdfjsLib === 'undefined') {
            alert('Library PDF.js gagal dimuat. Pastikan koneksi internet aktif.');
            return;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const totalPages = pdfDoc.numPages;
            const MAX_PDF_PAGES = 10;

            if (totalPages > MAX_PDF_PAGES) {
                alert(`Maksimal ${MAX_PDF_PAGES} halaman PDF dalam sekali konversi. File "${file.name}" memiliki ${totalPages} halaman.`);
                return;
            }

            if (currentFiles.length + totalPages > MAX_PDF_PAGES) {
                alert(`Total gambar dan halaman PDF melebihi batas maksimal ${MAX_PDF_PAGES} item dalam sekali konversi.`);
                return;
            }

            // Show workspace early while rendering pages
            uploadArea.classList.add('hidden');
            workspace.classList.remove('hidden');
            originalDimensions.textContent = `Memproses PDF (0/${totalPages})...`;

            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'document';
            const scale = 2.0;

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                originalDimensions.textContent = `Memproses PDF (${pageNum}/${totalPages})...`;

                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');

                // White background so PDF text/elements stay clear even on PNG/WEBP
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                await page.render({ canvasContext: ctx, viewport }).promise;

                const dataUrl = canvas.toDataURL('image/png');
                const img = await loadImageFromDataUrl(dataUrl);
                const pageLabel = `${file.name} (Hal. ${pageNum})`;
                const pageOriginalName = totalPages > 1 ? `${baseName}_page_${pageNum}` : baseName;

                currentFiles.push({
                    file,
                    image: img,
                    originalName: pageOriginalName,
                    rawDataUrl: dataUrl,
                    displaySize: pageNum === 1 ? file.size : 0
                });

                appendPreviewItem(dataUrl, pageOriginalName, pageLabel);
                updateStats();
            }
        } catch (error) {
            console.error('Error processing PDF:', error);
            alert(`Gagal membaca file PDF "${file.name}". Pastikan file tidak rusak atau terenkripsi.`);
            if (currentFiles.length === 0) {
                resetWorkspace();
            }
        }
    }

    function loadImageFromDataUrl(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    function appendPreviewItem(src, alt, label) {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `
            <img src="${src}" alt="${alt}">
            <div class="file-name" title="${label}">${label}</div>
        `;
        previewGallery.appendChild(item);
    }

    async function processPdfToolFile(file) {
        if (typeof window.PDFLib === 'undefined') {
            alert('Library pdf-lib gagal dimuat. Pastikan koneksi internet aktif.');
            return;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await window.PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
            const pageCount = pdfDoc.getPageCount();
            const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'document';

            // Render first page thumbnail using PDF.js if available
            let thumbDataUrl = '';
            if (typeof pdfjsLib !== 'undefined') {
                try {
                    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
                    const pdfJsDoc = await loadingTask.promise;
                    const page = await pdfJsDoc.getPage(1);
                    const viewport = page.getViewport({ scale: 0.6 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    thumbDataUrl = canvas.toDataURL('image/png');
                } catch (thumbErr) {
                    console.warn('Could not render PDF thumbnail:', thumbErr);
                }
            }

            pdfToolFiles.push({ file, arrayBuffer, pageCount, originalName });
            const label = `${file.name} (${pageCount} hal.)`;
            appendPreviewItem(thumbDataUrl, originalName, label);
        } catch (error) {
            console.error('Error loading PDF for tools:', error);
            alert(`Gagal membaca file PDF "${file.name}". Pastikan file tidak rusak atau terenkripsi.`);
        }
    }

    function updateStats() {
        if (currentMode === 'pdf') {
            const totalSize = pdfToolFiles.reduce((acc, obj) => acc + obj.file.size, 0);
            const totalPages = pdfToolFiles.reduce((acc, obj) => acc + obj.pageCount, 0);
            originalSize.textContent = `PDFs: ${pdfToolFiles.length}/10 (${totalPages} hal.)`;
            originalDimensions.textContent = `Total Size: ${formatBytes(totalSize)}`;
            return;
        }

        const totalSize = currentFiles.reduce((acc, obj) => acc + (obj.displaySize !== undefined ? obj.displaySize : obj.file.size), 0);
        originalSize.textContent = `Files: ${currentFiles.length}/10`;
        originalDimensions.textContent = `Total Size: ${formatBytes(totalSize)}`;
    }

    function renderItemToCanvas(item, fillWhite = false) {
        const canvas = document.createElement('canvas');
        const width = item.image.naturalWidth || item.image.width || 300;
        const height = item.image.naturalHeight || item.image.height || 150;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (fillWhite) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(item.image, 0, 0, width, height);

        return { canvas, width, height };
    }

    async function processPdfTools() {
        if (pdfToolFiles.length === 0) return;
        if (typeof window.PDFLib === 'undefined') {
            alert('Library pdf-lib gagal dimuat. Pastikan koneksi internet aktif.');
            return;
        }

        const action = pdfActionSelect.value;
        convertBtn.classList.add('loading');
        convertBtn.innerHTML = '<i class="ri-loader-4-line"></i> Processing...';

        convertedBlobs = [];
        currentObjectUrls.forEach(url => URL.revokeObjectURL(url));
        currentObjectUrls = [];

        setTimeout(async () => {
            try {
                const { PDFDocument } = window.PDFLib;

                if (action === 'merge') {
                    const mergedPdf = await PDFDocument.create();
                    for (const item of pdfToolFiles) {
                        const srcDoc = await PDFDocument.load(item.arrayBuffer);
                        const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
                        copiedPages.forEach(page => mergedPdf.addPage(page));
                    }
                    const pdfBytes = await mergedPdf.save();
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const newFileName = pdfToolFiles.length === 1
                        ? `${pdfToolFiles[0].originalName}_copy.pdf`
                        : 'Go_Converter_Merged.pdf';

                    convertedBlobs.push({ blob, newFileName });
                    currentObjectUrls.push(URL.createObjectURL(blob));
                } else {
                    // Split PDF
                    const rangeStr = pdfRangeInput.value.trim();

                    for (const item of pdfToolFiles) {
                        const srcDoc = await PDFDocument.load(item.arrayBuffer);
                        const totalPages = srcDoc.getPageCount();

                        if (rangeStr) {
                            const pageIndices = parsePageRange(rangeStr, totalPages);
                            if (!pageIndices || pageIndices.length === 0) {
                                alert(`Rentang halaman "${rangeStr}" tidak valid untuk "${item.file.name}" (1-${totalPages}).`);
                                convertBtn.classList.remove('loading');
                                hideDownloadBtn();
                                return;
                            }

                            const outPdf = await PDFDocument.create();
                            const copiedPages = await outPdf.copyPages(srcDoc, pageIndices);
                            copiedPages.forEach(page => outPdf.addPage(page));
                            const pdfBytes = await outPdf.save();
                            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                            const newFileName = `${item.originalName}_extracted.pdf`;

                            convertedBlobs.push({ blob, newFileName });
                            currentObjectUrls.push(URL.createObjectURL(blob));
                        } else {
                            // Split every page into separate PDF
                            for (let p = 0; p < totalPages; p++) {
                                const outPdf = await PDFDocument.create();
                                const [copiedPage] = await outPdf.copyPages(srcDoc, [p]);
                                outPdf.addPage(copiedPage);
                                const pdfBytes = await outPdf.save();
                                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                                const newFileName = `${item.originalName}_page_${p + 1}.pdf`;

                                convertedBlobs.push({ blob, newFileName });
                                currentObjectUrls.push(URL.createObjectURL(blob));
                            }
                        }
                    }
                }

                downloadBtn.classList.remove('hidden');
                downloadBtn.innerHTML = convertedBlobs.length > 1
                    ? '<i class="ri-download-2-line"></i> Download ZIP'
                    : '<i class="ri-download-2-line"></i> Download';

                convertBtn.classList.remove('loading');
                convertBtn.innerHTML = '<i class="ri-loop-right-line"></i> Process Again';

                const totalNewSize = convertedBlobs.reduce((acc, b) => acc + b.blob.size, 0);
                originalDimensions.textContent = `New Total: ${formatBytes(totalNewSize)}`;
            } catch (error) {
                console.error('Error processing PDF tools:', error);
                alert('Terjadi kesalahan saat memproses file PDF.');
                convertBtn.classList.remove('loading');
                hideDownloadBtn();
            }
        }, 50);
    }

    function parsePageRange(rangeStr, maxPages) {
        const indices = new Set();
        const parts = rangeStr.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) return null;

        for (const part of parts) {
            if (part.includes('-')) {
                const bounds = part.split('-').map(n => parseInt(n.trim(), 10));
                if (bounds.length !== 2 || isNaN(bounds[0]) || isNaN(bounds[1])) return null;
                const [start, end] = bounds;
                if (start < 1 || end > maxPages || start > end) return null;
                for (let i = start; i <= end; i++) {
                    indices.add(i - 1);
                }
            } else {
                const num = parseInt(part, 10);
                if (isNaN(num) || num < 1 || num > maxPages) return null;
                indices.add(num - 1);
            }
        }

        return Array.from(indices);
    }

    async function convertImages() {
        if (currentFiles.length === 0) return;

        // UI Feedback
        convertBtn.classList.add('loading');
        convertBtn.innerHTML = '<i class="ri-loader-4-line"></i> Converting...';

        // Cleanup old conversions
        convertedBlobs = [];
        currentObjectUrls.forEach(url => URL.revokeObjectURL(url));
        currentObjectUrls = [];

        // Allow UI to flush loading state
        setTimeout(async () => {
            const format = formatSelect.value;
            const quality = parseInt(qualitySlider.value) / 100;

            if (format === 'application/pdf') {
                if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
                    alert('Library jsPDF gagal dimuat. Pastikan koneksi internet aktif.');
                    convertBtn.classList.remove('loading');
                    convertBtn.innerHTML = '<i class="ri-loop-right-line"></i> Convert Image';
                    return;
                }

                try {
                    const { jsPDF } = window.jspdf;
                    let pdf = null;

                    for (let i = 0; i < currentFiles.length; i++) {
                        const item = currentFiles[i];
                        const { canvas, width, height } = renderItemToCanvas(item, true);
                        const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
                        const orientation = width >= height ? 'l' : 'p';

                        if (i === 0) {
                            pdf = new jsPDF({
                                orientation,
                                unit: 'px',
                                format: [width, height],
                                hotfixes: ['px_scaling']
                            });
                        } else {
                            pdf.addPage([width, height], orientation);
                        }

                        pdf.addImage(imgDataUrl, 'JPEG', 0, 0, width, height);
                    }

                    const pdfBlob = pdf.output('blob');
                    const pdfFileName = currentFiles.length === 1
                        ? `${currentFiles[0].originalName}_converted.pdf`
                        : 'Go_Converter_Merged.pdf';

                    convertedBlobs.push({ blob: pdfBlob, newFileName: pdfFileName });
                    currentObjectUrls.push(URL.createObjectURL(pdfBlob));
                } catch (error) {
                    console.error('Error creating PDF:', error);
                    alert('Terjadi kesalahan saat mengonversi gambar ke PDF.');
                    convertBtn.classList.remove('loading');
                    convertBtn.innerHTML = '<i class="ri-loop-right-line"></i> Convert Image';
                    return;
                }
            } else {
                let extension = 'jpg';
                if (format === 'image/png') extension = 'png';
                else if (format === 'image/webp') extension = 'webp';
                else if (format === 'image/svg+xml') extension = 'svg';

                for (let i = 0; i < currentFiles.length; i++) {
                    const item = currentFiles[i];
                    let blob;

                    if (format === 'image/svg+xml') {
                        // Check if the original file is already SVG
                        if (item.file.type === 'image/svg+xml' || item.file.name.toLowerCase().endsWith('.svg')) {
                            blob = item.file;
                        } else {
                            // Convert raster image (PNG, JPG, WEBP) to SVG wrapper
                            const width = item.image.naturalWidth || item.image.width || 300;
                            const height = item.image.naturalHeight || item.image.height || 150;
                            const dataUrl = item.rawDataUrl;
                            const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <image width="${width}" height="${height}" xlink:href="${dataUrl}"/>
</svg>`;
                            blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                        }
                    } else {
                        // Converting any format (including SVG input) to Canvas raster (JPEG, PNG, WEBP)
                        const { canvas } = renderItemToCanvas(item, format === 'image/jpeg');

                        // Convert using a Promise wrapper to work nicely with await
                        blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality));
                    }

                    // Unique name strategy if batching duplicates
                    const newFileName = `${item.originalName}_converted.${extension}`;

                    convertedBlobs.push({ blob, newFileName });
                    currentObjectUrls.push(URL.createObjectURL(blob));
                }
            }

            // Update UI after logic
            downloadBtn.classList.remove('hidden');

            if (convertedBlobs.length > 1) {
                downloadBtn.innerHTML = '<i class="ri-download-2-line"></i> Download ZIP';
            } else {
                downloadBtn.innerHTML = '<i class="ri-download-2-line"></i> Download';
            }

            convertBtn.classList.remove('loading');
            convertBtn.innerHTML = '<i class="ri-loop-right-line"></i> Convert Again';

            const totalNewSize = convertedBlobs.reduce((acc, b) => acc + b.blob.size, 0);
            originalDimensions.textContent = `New Total: ${formatBytes(totalNewSize)}`;

        }, 50);
    }

    async function downloadConvertedImages() {
        if (convertedBlobs.length === 0) return;

        if (convertedBlobs.length === 1) {
            // SINGLE FILE DOWNLOAD logic (Standard Browser Download)
            const { blob, newFileName } = convertedBlobs[0];

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = newFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Jeda sedikit sebelum revoke URL agar browser sempat memulai proses download
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
        } else {
            // MULTIPLE FILES DOWNLOAD logic via JSZip
            downloadBtn.classList.add('loading');
            downloadBtn.innerHTML = '<i class="ri-loader-4-line"></i> Zipping...';

            setTimeout(async () => {
                try {
                    const zip = new JSZip();
                    convertedBlobs.forEach(item => {
                        zip.file(item.newFileName, item.blob);
                    });

                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    const zipName = currentMode === 'pdf' ? 'Go_Converter_PDFs.zip' : 'Go_Converter_Images.zip';

                    const url = URL.createObjectURL(zipBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = zipName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    setTimeout(() => {
                        URL.revokeObjectURL(url);
                    }, 1000);

                } catch (error) {
                    console.error("Error creating ZIP", error);
                    alert("Terjadi kesalahan saat memproses file ZIP.");
                }

                downloadBtn.classList.remove('loading');
                downloadBtn.innerHTML = '<i class="ri-download-2-line"></i> Download ZIP';
            }, 50);
        }
    }

    function resetWorkspace() {
        // Clear state
        currentFiles = [];
        pdfToolFiles = [];
        convertedBlobs = [];
        currentObjectUrls.forEach(url => URL.revokeObjectURL(url));
        currentObjectUrls = [];

        previewGallery.innerHTML = '';
        fileInput.value = '';

        // Reset UI
        uploadArea.classList.remove('hidden');
        workspace.classList.add('hidden');
        downloadBtn.classList.add('hidden');

        // Reset selectors
        formatSelect.value = 'image/jpeg';
        qualitySlider.value = 80;
        qualityValue.textContent = '80%';
        qualityGroup.classList.remove('hidden');

        pdfActionSelect.value = 'merge';
        pdfRangeInput.value = '';
        pdfRangeGroup.classList.add('hidden');

        originalSize.textContent = currentMode === 'pdf' ? 'PDFs: 0/10' : 'Files: 0/10';
        originalDimensions.textContent = `Selected`;
        hideDownloadBtn();
    }

    function hideDownloadBtn() {
        downloadBtn.classList.add('hidden');
        if (currentMode === 'pdf') {
            convertBtn.innerHTML = pdfActionSelect.value === 'merge'
                ? '<i class="ri-file-copy-2-line"></i> Merge PDF'
                : '<i class="ri-scissors-cut-line"></i> Split PDF';
        } else {
            convertBtn.innerHTML = currentFiles.length > 1
                ? '<i class="ri-loop-right-line"></i> Convert Images'
                : '<i class="ri-loop-right-line"></i> Convert Image';
        }
    }

    // Helper: Format bytes to KB/MB
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Run
    init();
});
