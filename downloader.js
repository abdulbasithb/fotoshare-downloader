const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

// Base URL for FotoShare
const BASE_URL = "https://fotoshare.co";

function getUrlWithoutQueryString(fullUrl) {
  // Create a URL object
  const urlObj = new URL(fullUrl);

  // Get the URL without the query string
  return urlObj.origin + urlObj.pathname;
}

// Function to download file from URL
async function downloadFile(url, downloadPath) {
  try {
    const response = await axios({
      url,
      responseType: "stream",
    });

    const writer = fs.createWriteStream(downloadPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error) {
    console.error(`Failed to download ${url}:`, error.message);
  }
}

// Function to scrape and download images from FotoShare album
async function downloadAlbum(url) {
  const folder = path.join(__dirname, path.basename(url));

  // Create output directory if it doesn't exist
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  try {
    // Fetch the album page
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const data = [];
    $("[data-img][data-url]").each((index, element) => {
      const imageData = {
        imageUrl: getUrlWithoutQueryString($(element).attr("data-thumb")),
        thumbUrl: $(element).attr("data-thumb"),
        pathUrl: $(element).attr("data-url"),
        width: $(element).attr("data-width"),
        height: $(element).attr("data-height"),
        type: $(element).attr("data-type"),
      };

      console.log(imageData);
      // Ensure full URLs
      imageData.imageUrl = imageData.imageUrl.startsWith("http")
        ? imageData.imageUrl
        : `${BASE_URL}${imageData.imageUrl}`;
      imageData.pathUrl = imageData.pathUrl.startsWith("http")
        ? imageData.pathUrl
        : `${BASE_URL}${imageData.pathUrl}`;

      data.push(imageData);
    });

    console.log(`${data.length} files found.`);

    // CSV writer setup
    const csvWriter = createCsvWriter({
      path: path.join(folder, "images.csv"),
      header: [
        { id: "imageUrl", title: "Image URL" },
        { id: "thumbUrl", title: "GIF/Thumbnail" },
        { id: "pathUrl", title: "Fotoshare.co Path" },
        { id: "width", title: "Width" },
        { id: "height", title: "Height" },
        { id: "type", title: "Type" },
      ],
    });

    await csvWriter.writeRecords(data);

    // Download each image
    for (const [index, imageData] of data.entries()) {
      const imagePath = path.join(folder, path.basename(imageData.imageUrl));

      if (!fs.existsSync(imagePath)) {
        await downloadFile(imageData.imageUrl, imagePath);
        console.log(
          `(${index + 1}/${data.length}) Downloaded: ${path.basename(
            imageData.imageUrl
          )}`
        );
      } else {
        console.log(
          `(${index + 1}/${data.length}) Skipped: ${path.basename(
            imageData.imageUrl
          )}`
        );
      }
    }

    console.log("Download complete.");
  } catch (error) {
    console.error("Error downloading album:", error.message);
  }
}

// Example Usage
const albumUrl = process.argv[2] || "https://fotoshare.co/album/your-album-id"; // Replace with actual album URL
downloadAlbum(albumUrl);
