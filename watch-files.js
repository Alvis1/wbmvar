const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const watchDir = __dirname;
const debounceDelay = 1000; // Wait 1 second after last change
let debounceTimer = null;

console.log('🔍 Watching for HTML file changes...');
console.log('Directory:', watchDir);
console.log('Press Ctrl+C to stop\n');

// Function to regenerate the listing
function regenerateListing() {
    console.log('📝 Regenerating file listing...');
    exec('node generate-listing.js', { cwd: watchDir }, (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Error:', error.message);
            return;
        }
        if (stderr) {
            console.error('⚠️ Warning:', stderr);
        }
        console.log('✅', stdout.trim());
        console.log('Updated at:', new Date().toLocaleTimeString(), '\n');
    });
}

// Debounced regeneration
function scheduleRegeneration() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(regenerateListing, debounceDelay);
}

// Watch all subdirectories
function watchDirectory(dir) {
    try {
        const watcher = fs.watch(dir, { recursive: false }, (eventType, filename) => {
            if (filename && filename.toLowerCase().endsWith('.html')) {
                console.log(`🔔 ${eventType}: ${filename}`);
                scheduleRegeneration();
            }
        });

        // Watch subdirectories (for new HTML files in folders)
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory() && !item.startsWith('.') && !item.startsWith('node_modules')) {
                    fs.watch(fullPath, { recursive: false }, (eventType, filename) => {
                        if (filename && filename.toLowerCase().endsWith('.html')) {
                            console.log(`🔔 ${eventType}: ${item}/${filename}`);
                            scheduleRegeneration();
                        }
                    });
                }
            } catch (err) {
                // Skip files we can't access
            }
        });

    } catch (err) {
        console.error('Error setting up watch:', err);
    }
}

// Initial generation
regenerateListing();

// Start watching
watchDirectory(watchDir);

// Handle exit
process.on('SIGINT', () => {
    console.log('\n\n👋 Stopping file watcher...');
    process.exit(0);
});
