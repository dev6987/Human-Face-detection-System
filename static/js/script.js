document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    const faceOverlay = document.getElementById('face-overlay');
    const resultContent = document.getElementById('result-content');
    const faceResults = document.getElementById('face-results');
    const facesList = document.getElementById('faces-list');
    const loading = document.getElementById('loading');
    const endpointInput = document.getElementById('endpoint');

    let base64Image = null;
    let originalWidth = 0;
    let originalHeight = 0;

    const COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

    // Handle Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500', 'bg-blue-900/10');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-blue-500', 'bg-blue-900/10');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-900/10');
        const file = e.dataTransfer.files[0];
        handleFile(file);
    });

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFile(file);
    });

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            base64Image = e.target.result;
            previewImage.src = e.target.result;
            
            // Get original dimensions
            const img = new Image();
            img.onload = () => {
                originalWidth = img.width;
                originalHeight = img.height;
            };
            img.src = e.target.result;

            previewContainer.classList.remove('hidden');
            previewContainer.classList.add('animate-fade-in');
            
            // Clear old results
            faceOverlay.innerHTML = '';
            faceResults.classList.add('hidden');
            facesList.innerHTML = '';
        };
        reader.readAsDataURL(file);
    }

    function drawFaceBoxes(faces) {
        faceOverlay.innerHTML = '';
        const displayedWidth = previewImage.clientWidth;
        const displayedHeight = previewImage.clientHeight;
        
        const scaleX = displayedWidth / originalWidth;
        const scaleY = displayedHeight / originalHeight;

        faces.forEach((face, index) => {
            const box = face.boundingBox;
            const color = COLORS[index % COLORS.length];

            const faceBox = document.createElement('div');
            faceBox.className = 'face-box animate-fade-in';
            faceBox.style.borderColor = color;
            faceBox.style.backgroundColor = `${color}20`; // 20% opacity
            faceBox.style.color = color;
            
            // Position and size
            faceBox.style.left = `${box.left * scaleX}px`;
            faceBox.style.top = `${box.top * scaleY}px`;
            faceBox.style.width = `${box.width * scaleX}px`;
            faceBox.style.height = `${box.height * scaleY}px`;
            
            // Label
            const label = document.createElement('div');
            label.className = 'face-label';
            label.style.backgroundColor = color;
            label.innerText = `${face.gender}, ${face.age}`;
            faceBox.appendChild(label);
            
            faceOverlay.appendChild(faceBox);
        });
    }

    // Handle window resize to reposition boxes
    window.addEventListener('resize', () => {
        if (faceOverlay.children.length > 0 && lastFacesData) {
            drawFaceBoxes(lastFacesData);
        }
    });

    let lastFacesData = null;

    // Analyze Button
    analyzeBtn.addEventListener('click', async () => {
        const apiKey = document.getElementById('api_key').value.trim();
        const endpoint = endpointInput.value.trim();

        if (!apiKey || !endpoint || !base64Image) {
            alert('Please provide your Azure API key, Endpoint, and select an image.');
            return;
        }

        // UI State
        analyzeBtn.disabled = true;
        loading.classList.remove('hidden');
        resultContent.classList.add('hidden');
        faceResults.classList.add('hidden');
        resultContent.innerHTML = '';
        facesList.innerHTML = '';
        faceOverlay.innerHTML = '';

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: base64Image,
                    api_key: apiKey,
                    endpoint: endpoint
                })
            });

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            lastFacesData = data.faces;

            // Show Result
            resultContent.innerHTML = `<p class="animate-fade-in text-lg font-medium text-blue-100">${data.description}</p>`;
            
            // Draw Boxes on Image
            if (data.faces && data.faces.length > 0) {
                drawFaceBoxes(data.faces);
                
                // Show Faces in Sidebar
                faceResults.classList.remove('hidden');
                data.faces.forEach((face, index) => {
                    const color = COLORS[index % COLORS.length];
                    const faceDiv = document.createElement('div');
                    faceDiv.className = 'bg-gray-700/50 p-3 rounded-lg border-l-4 flex items-center space-x-4 animate-fade-in';
                    faceDiv.style.borderLeftColor = color;
                    faceDiv.style.animationDelay = `${index * 0.1}s`;
                    
                    const gender = face.gender || 'Unknown';
                    const genderIcon = gender.toLowerCase() === 'male' ? 'fa-mars text-blue-400' : 
                                      gender.toLowerCase() === 'female' ? 'fa-venus text-pink-400' : 
                                      'fa-user text-gray-400';
                    
                    faceDiv.innerHTML = `
                        <div class="bg-gray-800 w-10 h-10 rounded-full flex items-center justify-center">
                            <i class="fas ${genderIcon}"></i>
                        </div>
                        <div>
                            <p class="text-white font-medium">${gender}</p>
                            <p class="text-gray-400 text-sm">Estimated Age: ${face.age || 'Unknown'}</p>
                        </div>
                    `;
                    facesList.appendChild(faceDiv);
                });
            } else {
                faceResults.classList.add('hidden');
            }

        } catch (error) {
            resultContent.innerHTML = `<p class="text-red-400 border border-red-900 bg-red-900/20 p-4 rounded-lg animate-fade-in">Error: ${error.message}</p>`;
        } finally {
            analyzeBtn.disabled = false;
            loading.classList.add('hidden');
            resultContent.classList.remove('hidden');
        }
    });
});
