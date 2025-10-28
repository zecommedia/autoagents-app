// Photoshop JSX Script to replace Smart Object content
// Usage: photoshop.exe -r "replacesmartobject.jsx" with MOCKUP_ARGS env variable

#target photoshop

// Get arguments from environment variable
var args = $.getenv("MOCKUP_ARGS").split("|");
var psdPath = args[0];
var stickerPath = args[1];
var outputPath = args[2];

// Suppress all dialogs
app.displayDialogs = DialogModes.NO;
app.bringToFront();

try {
    // Open PSD file
    var psdFile = new File(psdPath);
    if (!psdFile.exists) {
        throw new Error("PSD file not found: " + psdPath);
    }
    
    var doc = app.open(psdFile);
    
    // Replace Smart Object content in all layers named "REPLACE"
    replaceSmartObjectContent("REPLACE", stickerPath);
    
    // Export as PNG
    var exportFile = new File(outputPath);
    var opts = new ExportOptionsSaveForWeb();
    opts.format = SaveDocumentType.PNG;
    opts.PNG8 = false;
    opts.transparency = true;
    opts.interlaced = false;
    opts.quality = 100;
    
    doc.exportDocument(exportFile, ExportType.SAVEFORWEB, opts);
    
    // Close without saving PSD
    doc.close(SaveOptions.DONOTSAVECHANGES);
    
    // Success - output must be on separate line for Node.js to capture
    $.writeln("SUCCESS");
    
} catch (error) {
    // Error - output must be on separate line for Node.js to capture
    $.writeln("ERROR: " + error.message);
} finally {
    // Always try to quit Photoshop after processing
    try {
        var idquit = charIDToTypeID("quit");
        var desc = new ActionDescriptor();
        desc.putBoolean(charIDToTypeID("svng"), false); // Don't save
        executeAction(idquit, desc, DialogModes.NO);
    } catch (quitError) {
        // If action fails, force quit
        app.quit();
    }
}

// Function to replace Smart Object content for all layers with matching name
function replaceSmartObjectContent(smartLayerName, newImageFile) {
    var mainDoc = app.activeDocument;
    
    // Find all layers with the target name
    var layers = findLayersByName(smartLayerName);
    
    if (layers.length === 0) {
        throw new Error("No layer named '" + smartLayerName + "' found");
    }
    
    // Check if sticker file exists
    var imageFile = new File(newImageFile);
    if (!imageFile.exists) {
        throw new Error("Sticker file not found: " + newImageFile);
    }
    
    // Replace content in each matching layer
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        
        // Verify it's a Smart Object
        if (!(layer instanceof ArtLayer) || layer.kind !== LayerKind.SMARTOBJECT) {
            $.writeln("WARNING: Layer '" + smartLayerName + "' is not a Smart Object, skipping");
            continue;
        }
        
        // Select the Smart Object layer
        mainDoc.activeLayer = layer;
        
        // Open Smart Object content for editing
        var idplacedLayerEditContents = stringIDToTypeID("placedLayerEditContents");
        executeAction(idplacedLayerEditContents, undefined, DialogModes.NO);
        
        // Now the Smart Object document (.psb) is active
        var psbDoc = app.activeDocument;
        
        // Open the new sticker image
        var newImage = app.open(imageFile);
        
        // Duplicate sticker into Smart Object document
        newImage.activeLayer.duplicate(psbDoc);
        
        // Close the sticker document
        newImage.close(SaveOptions.DONOTSAVECHANGES);
        
        // Get the newly added layer (should be activeLayer after duplicate)
        var newLayer = psbDoc.activeLayer;
        
        // Get Smart Object canvas dimensions
        var psbWidth = psbDoc.width.as("px");
        var psbHeight = psbDoc.height.as("px");
        
        // Get layer dimensions
        var bounds = newLayer.bounds;
        var layerWidth = bounds[2].as("px") - bounds[0].as("px");
        var layerHeight = bounds[3].as("px") - bounds[1].as("px");
        
        // Calculate scale ratio to fit canvas while maintaining aspect ratio
        var scaleRatio = Math.min(psbWidth / layerWidth, psbHeight / layerHeight) * 100;
        newLayer.resize(scaleRatio, scaleRatio, AnchorPosition.MIDDLECENTER);
        
        // Calculate offset to center the layer
        bounds = newLayer.bounds;
        var offsetX = (psbWidth - (bounds[2].as("px") - bounds[0].as("px"))) / 2 - bounds[0].as("px");
        var offsetY = (psbHeight - (bounds[3].as("px") - bounds[1].as("px"))) / 2 - bounds[1].as("px");
        
        // Center the layer
        newLayer.translate(offsetX, offsetY);
        
        // Hide the old layer(s) if they exist (don't delete to preserve effects)
        if (psbDoc.layers.length > 1) {
            for (var j = 1; j < psbDoc.layers.length; j++) {
                psbDoc.layers[j].visible = false;
            }
        }
        
        // Save and close Smart Object
        psbDoc.close(SaveOptions.SAVECHANGES);
        
        // Back to main document
        app.activeDocument = mainDoc;
    }
}

// Function to find all layers by name (recursive search)
function findLayersByName(layerName) {
    var foundLayers = [];
    var doc = app.activeDocument;
    
    function searchLayers(layers) {
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            
            if (layer.typename === "LayerSet") {
                // It's a group, search inside
                searchLayers(layer.layers);
            } else if (layer.typename === "ArtLayer") {
                // Check if name matches (case insensitive)
                if (layer.name.toUpperCase() === layerName.toUpperCase()) {
                    foundLayers.push(layer);
                }
            }
        }
    }
    
    searchLayers(doc.layers);
    return foundLayers;
}
