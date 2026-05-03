const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

// العناصر الأساسية
const authBtn = document.getElementById('authBtn');
const videoContainer = document.getElementById('videoContainer');
const mainSection = document.getElementById('mainSection');
const submitBtn = document.getElementById('submitBtn');
const videoSelectDisplay = document.getElementById('videoSelect');

let selectedVideoId = null;

// دمج ترويسات الأمان للصور المصغرة
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 1. جلب الفيديوهات
authBtn.addEventListener('click', async () => {
    const clientId = document.getElementById('clientId').value;
    const pin = document.getElementById('pinCode').value;

    if(!clientId || !pin) return alert("يرجى إدخال البيانات");

    try {
        const response = await fetch(`https://tasneemahmed-n8n.hf.space/webhook/get-videos-list?client_id=${clientId}&pin=${pin}`);
        const data = await response.json();

        if (data.error) throw new Error(data.message);

        videoContainer.innerHTML = '';
        data.videos.forEach(video => {
            const item = document.createElement('div');
            item.className = 'video-item';
            // إضافة crossorigin لتجنب أخطاء CORS في الصور
            item.innerHTML = `
                <img src="${video.thumbnail_url}" crossorigin="anonymous" referrerpolicy="no-referrer" alt="Video">
                <p style="font-size:12px; padding:5px;">${video.name}</p>
            `;
            item.onclick = () => {
                document.querySelectorAll('.video-item').forEach(v => v.classList.remove('selected'));
                item.classList.add('selected');
                selectedVideoId = video.id;
                videoSelectDisplay.value = video.name;
            };
            videoContainer.appendChild(item);
        });

        mainSection.classList.remove('hidden');
    } catch (e) {
        alert("فشل التحقق: " + e.message);
    }
});

// 2. معالجة الفيديو (المنطق الأساسي)
submitBtn.addEventListener('click', async () => {
    const audioFile = document.getElementById('audioFile').files[0];
    const clientId = document.getElementById('clientId').value;
    const pin = document.getElementById('pinCode').value;

    if(!audioFile || !selectedVideoId) return alert("اختر فيديو وصوت أولاً");

    submitBtn.disabled = true;
    document.getElementById('progressSection').classList.remove('hidden');
    const statusText = document.getElementById('statusText');
    const progressFill = document.getElementById('progressFill');

    try {
        if (!ffmpeg.isLoaded()) {
            statusText.innerText = "جاري تحميل محرك المعالجة...";
            await ffmpeg.load();
        }

        // جلب فيديو البروكسي (معالجة أخطاء CORS)
        statusText.innerText = "جاري تحميل الفيديو...";
        const videoUrl = `https://tasneemahmed-n8n.hf.space/webhook/get-video-proxy?video_id=${selectedVideoId}&client_id=${clientId}&pin=${pin}`;
        const videoData = await fetchFile(videoUrl);
        ffmpeg.FS('writeFile', 'input_video.mp4', videoData);

        // تحميل الصوت
        statusText.innerText = "جاري تحضير الصوت...";
        ffmpeg.FS('writeFile', 'input_audio.mp3', await fetchFile(audioFile));

        // حساب المدد (تبسيطاً نعتبر الصوت هو الأساس)
        statusText.innerText = "جاري الدمج (720p HD)... يرجى الانتظار ولا تغلق الصفحة";
        
        // أمر المعالجة بجودة 720p و 30fps
        await ffmpeg.run(
            '-i', 'input_video.mp4',
            '-i', 'input_audio.mp3',
            '-filter_complex', '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v]',
            '-map', '[v]',
            '-map', '1:a',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26',
            '-c:a', 'aac', '-shortest',
            'output.mp4'
        );

        const finalData = ffmpeg.FS('readFile', 'output.mp4');
        const blob = new Blob([finalData.buffer], { type: 'video/mp4' });
        
        // تحميل الملف للعميل
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `final_video_${Date.now()}.mp4`;
        a.click();

        statusText.innerText = "تم بنجاح! جاري تحميل الفيديو لجهازك...";
        progressFill.style.width = "100%";

    } catch (e) {
        console.error(e);
        statusText.innerText = "حدث خطأ أثناء المعالجة!";
    } finally {
        submitBtn.disabled = false;
    }
});
