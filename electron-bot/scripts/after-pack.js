/**
 * After Pack Hook
 * Paketleme sonrası gereksiz dosyaları siler → installer boyutunu küçültür.
 */
const fs = require('fs');
const path = require('path');

function deleteFolderSync(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`  [CLEANUP] Silindi: ${path.basename(dirPath)} (${dirPath.split('app.asar.unpacked').pop() || dirPath.split('resources').pop()})`);
}

exports.default = async function afterPack(context) {
    const appOutDir = context.appOutDir;
    const resourcesDir = path.join(appOutDir, 'resources');

    console.log('[AFTER-PACK] Gereksiz dosyalar temizleniyor...');

    // 1. onnxruntime-node: sadece win32 gerekli (darwin + linux kaldır)
    const onnxBinDir = path.join(resourcesDir, 'app.asar.unpacked', 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6');
    deleteFolderSync(path.join(onnxBinDir, 'darwin'));
    deleteFolderSync(path.join(onnxBinDir, 'linux'));

    console.log('[AFTER-PACK] Temizlik tamamlandi.');
};
