document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const openCameraBtn = document.getElementById('open-camera-btn');
    
    // Sections
    const uploadSection = document.getElementById('upload-section');
    const cameraSection = document.getElementById('camera-section');
    const loadingSection = document.getElementById('loading-section');
    const resultSection = document.getElementById('result-section');
    
    // Preview
    const previewImage = document.getElementById('preview-image');
    const resultImage = document.getElementById('result-image');
    
    // Results
    const statusBadge = document.getElementById('status-badge');
    const confidenceText = document.getElementById('confidence-text');
    const confidenceBar = document.getElementById('confidence-bar');
    const reasonText = document.getElementById('reason-text');

    // Camera
    const cameraFeed = document.getElementById('camera-feed');
    const captureBtn = document.getElementById('capture-btn');
    const closeCameraBtn = document.getElementById('close-camera-btn');
    const cameraCanvas = document.getElementById('camera-canvas');
    let videoStream = null;

    // Drag and Drop Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragover');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) handleFile(files[0]);
    });

    // File Input Events
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) handleFile(this.files[0]);
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onloadend = () => {
            const base64data = reader.result;
            showLoading(base64data);
            analyzeImage(base64data);
        };
    }

    function showLoading(imageSrc) {
        previewImage.src = imageSrc;
        uploadSection.classList.remove('active');
        loadingSection.classList.add('active');
    }

    async function analyzeImage(base64Image) {
        try {
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ image: base64Image })
            });

            if (!response.ok) {
                throw new Error('Failed to analyze image');
            }

            const data = await response.json();
            showResult(data, base64Image);
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while analyzing the image. Please try again.');
            resetApp();
        }
    }

    function showResult(data, imageSrc) {
        loadingSection.classList.remove('active');
        resultSection.classList.add('active');
        
        resultImage.src = imageSrc;
        
        // Update UI based on status
        const isFresh = data.status.toLowerCase() === 'fresh';
        
        statusBadge.textContent = data.status;
        statusBadge.className = `badge ${isFresh ? 'fresh' : 'rotten'}`;
        
        confidenceText.textContent = `${data.confidence}%`;
        
        // Small delay to allow CSS transition to play
        setTimeout(() => {
            confidenceBar.style.width = `${data.confidence}%`;
            confidenceBar.className = `progress-bar-fill ${isFresh ? 'fresh' : 'rotten'}`;
        }, 100);
        
        reasonText.textContent = data.reason;
    }

    // Global reset function
    window.resetApp = function() {
        fileInput.value = '';
        confidenceBar.style.width = '0%';
        
        resultSection.classList.remove('active');
        loadingSection.classList.remove('active');
        cameraSection.classList.remove('active');
        uploadSection.classList.add('active');
    };

    // Camera handling
    openCameraBtn.addEventListener('click', async () => {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            cameraFeed.srcObject = videoStream;
            uploadSection.classList.remove('active');
            cameraSection.classList.add('active');
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Could not access the camera. Please ensure permissions are granted.');
        }
    });

    function closeCamera() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
        cameraSection.classList.remove('active');
    }

    closeCameraBtn.addEventListener('click', () => {
        closeCamera();
        uploadSection.classList.add('active');
    });

    captureBtn.addEventListener('click', () => {
        if (!videoStream) return;
        
        const context = cameraCanvas.getContext('2d');
        cameraCanvas.width = cameraFeed.videoWidth;
        cameraCanvas.height = cameraFeed.videoHeight;
        context.drawImage(cameraFeed, 0, 0, cameraCanvas.width, cameraCanvas.height);
        
        // Convert to highly-compressed JPEG right in browser
        const base64data = cameraCanvas.toDataURL('image/jpeg', 0.8);
        closeCamera();
        showLoading(base64data);
        analyzeImage(base64data);
    });
});

