const fs = require('fs');
const path = require('path');

// Function to get all HTML files in a directory
function getHtmlFiles(dir, baseDir = dir) {
    const results = {};
    
    try {
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && !item.startsWith('node_modules')) {
                const htmlFiles = [];
                const dirItems = fs.readdirSync(fullPath);
                
                dirItems.forEach(file => {
                    const filePath = path.join(fullPath, file);
                    const fileStat = fs.statSync(filePath);
                    
                    if (fileStat.isFile() && file.toLowerCase().endsWith('.html')) {
                        htmlFiles.push({
                            name: file,
                            path: path.relative(baseDir, filePath).replace(/\\/g, '/')
                        });
                    }
                });
                
                if (htmlFiles.length > 0) {
                    results[item] = htmlFiles;
                }
            }
        });
    } catch (err) {
        console.error('Error reading directory:', err);
    }
    
    return results;
}

// Generate the listing
const currentDir = __dirname;
const listing = getHtmlFiles(currentDir);

// Write to JSON file
const jsonOutput = JSON.stringify(listing, null, 2);
fs.writeFileSync(path.join(currentDir, 'files-listing.json'), jsonOutput);

console.log('File listing generated successfully!');
console.log('Found folders:', Object.keys(listing).length);
