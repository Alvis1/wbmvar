const fs = require("fs");
const path = require("path");

// Function to recursively find all HTML files in a directory
function findHtmlFilesRecursive(dir, baseDir, htmlFiles = []) {
  try {
    const items = fs.readdirSync(dir);

    items.forEach((item) => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (
        stat.isDirectory() &&
        !item.startsWith(".") &&
        !item.startsWith("node_modules")
      ) {
        // Recursively search subdirectories
        findHtmlFilesRecursive(fullPath, baseDir, htmlFiles);
      } else if (stat.isFile() && item.toLowerCase().endsWith(".html")) {
        htmlFiles.push({
          name: item,
          path: path.relative(baseDir, fullPath).replace(/\\/g, "/"),
        });
      }
    });
  } catch (err) {
    console.error("Error reading directory:", err);
  }

  return htmlFiles;
}

// Function to get all HTML files in a directory (including subfolders)
function getHtmlFiles(dir, baseDir = dir) {
  const results = {};

  try {
    const items = fs.readdirSync(dir);

    items.forEach((item) => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (
        stat.isDirectory() &&
        !item.startsWith(".") &&
        !item.startsWith("node_modules")
      ) {
        // Find all HTML files recursively in this folder
        const htmlFiles = findHtmlFilesRecursive(fullPath, baseDir);

        if (htmlFiles.length > 0) {
          results[item] = htmlFiles;
        }
      }
    });
  } catch (err) {
    console.error("Error reading directory:", err);
  }

  return results;
}

// Generate the listing
const currentDir = __dirname;
const listing = getHtmlFiles(currentDir);

// Write to JSON file
const jsonOutput = JSON.stringify(listing, null, 2);
fs.writeFileSync(path.join(currentDir, "files-listing.json"), jsonOutput);

console.log("File listing generated successfully!");
console.log("Found folders:", Object.keys(listing).length);
