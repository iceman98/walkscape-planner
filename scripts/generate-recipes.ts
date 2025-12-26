import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface Recipe {
  name: string;
  output: string;
  requirements: {
    profession?: {
      name: string;
      level: number;
      icon?: string; // SVG path or data
    };
    materials: Array<{
      name: string;
      amount: number;
      icon?: string; // SVG path or data
    }>;
    service?: string;
  };
}

interface ExtractedSVGs {
  materials: Record<string, string>;
  professions: Record<string, string>;
}

function extractSVGFromElement($element: any): string | null {
  const svg = $element.find('svg').first();
  if (svg.length > 0) {
    // Inline SVG found
    let svgContent = svg.html() || '';
    svgContent = svgContent.replace(/<script[^>]*>.*?<\/script>/gs, '');
    
    if (!svgContent.startsWith('<svg')) {
      const attrs = svg.attr() || {};
      const attrString = Object.entries(attrs)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      svgContent = `<svg ${attrString}>${svgContent}</svg>`;
    }
    
    return svgContent;
  }
  
  // Check for img elements pointing to SVG files
  const img = $element.find('img').first();
  if (img.length > 0) {
    const src = img.attr('src');
    if (src && src.endsWith('.svg')) {
      return src; // Return the URL to download
    }
  }
  
  return null;
}

async function downloadSVG(url: string): Promise<string | null> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://wiki.walkscape.app${url}`;
    const response = await axios.get(fullUrl, { responseType: 'text' });
    return response.data;
  } catch (error) {
    console.error(`Failed to download SVG from ${url}:`, error);
    return null;
  }
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    .replace(/^_|_$/g, '');
}

function saveSVGsToFile(svgs: ExtractedSVGs): void {
  const assetsDir = 'src/lib/assets';
  
  // Create directories if they don't exist
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }
  
  const materialsDir = join(assetsDir, 'materials');
  const professionsDir = join(assetsDir, 'professions');
  
  if (!existsSync(materialsDir)) {
    mkdirSync(materialsDir, { recursive: true });
  }
  
  if (!existsSync(professionsDir)) {
    mkdirSync(professionsDir, { recursive: true });
  }
  
  // Save material SVGs
  Object.entries(svgs.materials).forEach(([name, svg]) => {
    const fileName = sanitizeFileName(name);
    const filePath = join(materialsDir, `${fileName}.svg`);
    writeFileSync(filePath, svg, 'utf8');
    console.log(`Saved material SVG: ${filePath}`);
  });
  
  // Save profession SVGs
  Object.entries(svgs.professions).forEach(([name, svg]) => {
    const fileName = sanitizeFileName(name);
    const filePath = join(professionsDir, `${fileName}.svg`);
    writeFileSync(filePath, svg, 'utf8');
    console.log(`Saved profession SVG: ${filePath}`);
  });
  
  // Save index file for easy importing
  const indexPath = join(assetsDir, 'icons.json');
  const iconIndex = {
    materials: Object.fromEntries(
      Object.entries(svgs.materials).map(([name, _]) => [
        name,
        `./materials/${sanitizeFileName(name)}.svg`
      ])
    ),
    professions: Object.fromEntries(
      Object.entries(svgs.professions).map(([name, _]) => [
        name,
        `./professions/${sanitizeFileName(name)}.svg`
      ])
    )
  };
  
  writeFileSync(indexPath, JSON.stringify(iconIndex, null, 2), 'utf8');
  console.log(`Saved icon index: ${indexPath}`);
}

async function fetchRecipesFromWiki(): Promise<{ recipes: Recipe[], svgs: ExtractedSVGs }> {
  const recipes: Recipe[] = [];
  const svgs: ExtractedSVGs = {
    materials: {},
    professions: {}
  };

  try {
    // Walkscape wiki recipes page URL
    const wikiUrl = 'https://wiki.walkscape.app/wiki/Recipes';

    console.log('Fetching recipes from Walkscape wiki...');
    const response = await axios.get(wikiUrl);
    const $ = cheerio.load(response.data);

    // Parse HTML table rows - each recipe row has 10 cells
    const rows = $('table.wikitable tbody tr').toArray();
    
    // Process all rows asynchronously
    const rowPromises = rows.map(async (element) => {
      const $element = $(element);
      const cells = $element.find('td');
      
      // Skip header rows and rows without enough cells
      if (cells.length !== 10) return null;
      
      // Extract data from cells
      // Cell 0: Icon
      // Cell 1: Recipe name and output
      // Cell 2: Level and profession
      // Cell 3: Service requirement
      // Cell 4: Materials used
      // Cells 5-9: Experience data (skip for now)
      
      const iconCell = $(cells[0]);
      const recipeNameCell = $(cells[1]);
      const levelCell = $(cells[2]);
      const serviceCell = $(cells[3]);
      const materialsCell = $(cells[4]);
      
      // Extract recipe name and output first
      const recipeLink = recipeNameCell.find('a').first();
      const output = recipeLink.text().trim();
      const name = recipeNameCell.text().trim();
      
      if (!output) return null;
      
      // Extract recipe icon from cell 0
      const recipeIconSrc = extractSVGFromElement(iconCell);
      let recipeIconPath: string | undefined;
      
      if (recipeIconSrc && recipeIconSrc.startsWith('/')) {
        // Download the recipe SVG
        const recipeSVG = await downloadSVG(recipeIconSrc);
        if (recipeSVG) {
          const recipeIconName = sanitizeFileName(output);
          svgs.materials[output] = recipeSVG; // Store recipe output as material
          recipeIconPath = `./materials/${recipeIconName}.svg`;
        }
      }
      
      // Extract profession and level with SVG
      const professionLink = levelCell.find('a').last();
      const profession = professionLink.text().trim();
      const levelText = levelCell.text();
      const levelMatch = levelText.match(/lvl (\d+)/);
      const level = levelMatch ? parseInt(levelMatch[1]) : 1;
      
      // Extract profession SVG
      if (profession && profession !== '') {
        const professionSVG = extractSVGFromElement(levelCell);
        if (professionSVG && professionSVG.startsWith('/')) {
          const downloadedSVG = await downloadSVG(professionSVG);
          if (downloadedSVG && !svgs.professions[profession]) {
            svgs.professions[profession] = downloadedSVG;
          }
        }
      }
      
      // Extract service
      const serviceLink = serviceCell.find('a').last();
      const service = serviceLink.text().trim();
      
      // Extract materials with SVGs
      const materials: Array<{ name: string; amount: number; icon?: string }> = [];
      const materialLinks = materialsCell.find('a');
      
      for (let i = 0; i < materialLinks.length; i++) {
        const $matLink = $(materialLinks[i]);
        const materialName = $matLink.text().trim();
        
        if (materialName) {
          // Look for amount before the material link
          const prevText = $matLink.parent().contents().filter(function(this: Node) {
            return this.nodeType === 3; // Text node
          }).text().trim();
          
          const amountMatch = prevText.match(/(\d+)\s*<big>x<\/big>/);
          const amount = amountMatch ? parseInt(amountMatch[1]) : 1;
          
          // Extract material SVG
          const materialSVG = extractSVGFromElement($matLink.parent());
          let iconPath: string | undefined;
          
          if (materialSVG && materialSVG.startsWith('/')) {
            const downloadedSVG = await downloadSVG(materialSVG);
            if (downloadedSVG && !svgs.materials[materialName]) {
              svgs.materials[materialName] = downloadedSVG;
            }
            iconPath = `./materials/${sanitizeFileName(materialName)}.svg`;
          }
          
          materials.push({
            name: materialName,
            amount: amount,
            icon: iconPath
          });
        }
      }
      
      if (materials.length > 0) {
        const recipe: Recipe = {
          name: name,
          output: output,
          requirements: {
            materials: materials
          }
        };
        
        if (profession && profession !== '') {
          recipe.requirements.profession = {
            name: profession,
            level: level,
            icon: `./professions/${sanitizeFileName(profession)}.svg`
          };
        }
        
        if (service && service !== '') {
          recipe.requirements.service = service;
        }
        
        return recipe;
      }
      
      return null;
    });
    
    const recipeResults = await Promise.all(rowPromises);
    recipes.push(...recipeResults.filter((r): r is Recipe => r !== null));

    console.log(`Found ${recipes.length} recipes`);
    console.log(`Extracted ${Object.keys(svgs.materials).length} material SVGs`);
    console.log(`Extracted ${Object.keys(svgs.professions).length} profession SVGs`);

  } catch (error) {
    console.error('Error fetching recipes from wiki:', error);

    // If web scraping fails, return some example recipes
    console.log('Using example recipes as fallback...');
    return {
      recipes: [
        {
          name: "Create a Birch Plank (Scrap)",
          output: "Birch Plank",
          requirements: {
            profession: {
              name: "Carpentry",
              level: 1,
              icon: "./professions/carpentry.svg"
            },
            materials: [
              {
                name: "Wood Scrap",
                amount: 5,
                icon: "./materials/wood_scrap.svg"
              }
            ],
            service: "Basic Sawmill"
          }
        },
        {
          name: "Make a Basic Hatchet",
          output: "Basic Hatchet",
          requirements: {
            profession: {
              name: "Crafting",
              level: 1,
              icon: "./professions/crafting.svg"
            },
            materials: [
              {
                name: "Stone",
                amount: 2,
                icon: "./materials/stone.svg"
              },
              {
                name: "Wooden Stick",
                amount: 1,
                icon: "./materials/wooden_stick.svg"
              }
            ]
          }
        }
      ],
      svgs: {
        materials: {},
        professions: {}
      }
    };
  }

  return { recipes, svgs };
}

async function generateRecipesJson() {
  console.log('Starting recipe generation...');

  const { recipes, svgs } = await fetchRecipesFromWiki();

  // Write to recipes.json
  const recipesPath = 'src/data/recipes.json';
  writeFileSync(recipesPath, JSON.stringify(recipes, null, 4), 'utf8');
  console.log(`Successfully generated ${recipes.length} recipes in ${recipesPath}`);

  // Save SVG files
  if (Object.keys(svgs.materials).length > 0 || Object.keys(svgs.professions).length > 0) {
    saveSVGsToFile(svgs);
  } else {
    console.log('No SVGs to save (using fallback recipes)');
  }
}

// Run the script
generateRecipesJson().catch(console.error);
