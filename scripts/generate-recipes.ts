import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';

interface Recipe {
  name: string;
  output: string;
  requirements: {
    profession?: {
      name: string;
      level: number;
    };
    materials: Array<{
      name: string;
      amount: number;
    }>;
    service?: string;
  };
}

async function fetchRecipesFromWiki(): Promise<Recipe[]> {
  const recipes: Recipe[] = [];

  try {
    // Walkscape wiki recipes page URL
    const wikiUrl = 'https://wiki.walkscape.app/wiki/Recipes';

    console.log('Fetching recipes from Walkscape wiki...');
    const response = await axios.get(wikiUrl);
    const $ = cheerio.load(response.data);

    // Parse HTML table rows - each recipe row has 10 cells
    $('table.wikitable tbody tr').each((index, element) => {
      const $element = $(element);
      const cells = $element.find('td');
      
      // Skip header rows and rows without enough cells
      if (cells.length !== 10) return;
      
      // Extract data from cells
      // Cell 0: Icon (skip)
      // Cell 1: Recipe name and output
      // Cell 2: Level and profession
      // Cell 3: Service requirement
      // Cell 4: Materials used
      // Cells 5-9: Experience data (skip for now)
      
      const recipeNameCell = $(cells[1]);
      const levelCell = $(cells[2]);
      const serviceCell = $(cells[3]);
      const materialsCell = $(cells[4]);
      
      // Extract recipe name and output
      const recipeLink = recipeNameCell.find('a').first();
      const output = recipeLink.text().trim();
      const name = recipeNameCell.text().trim();
      
      if (!output) return;
      
      // Extract profession and level
      const professionLink = levelCell.find('a').last();
      const profession = professionLink.text().trim();
      const levelText = levelCell.text();
      const levelMatch = levelText.match(/lvl (\d+)/);
      const level = levelMatch ? parseInt(levelMatch[1]) : 1;
      
      // Extract service
      const serviceLink = serviceCell.find('a').last();
      const service = serviceLink.text().trim();
      
      // Extract materials
      const materials: Array<{ name: string; amount: number }> = [];
      const materialLinks = materialsCell.find('a');
      
      materialLinks.each((i, matLink) => {
        const $matLink = $(matLink);
        const materialName = $matLink.text().trim();
        
        if (materialName) {
          // Look for amount before the material link
          const prevText = $matLink.parent().contents().filter(function(this: Node) {
            return this.nodeType === 3; // Text node
          }).text().trim();
          
          const amountMatch = prevText.match(/(\d+)\s*<big>x<\/big>/);
          const amount = amountMatch ? parseInt(amountMatch[1]) : 1;
          
          materials.push({
            name: materialName,
            amount: amount
          });
        }
      });
      
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
            level: level
          };
        }
        
        if (service && service !== '') {
          recipe.requirements.service = service;
        }
        
        recipes.push(recipe);
      }
    });

    console.log(`Found ${recipes.length} recipes`);

  } catch (error) {
    console.error('Error fetching recipes from wiki:', error);

    // If web scraping fails, return some example recipes
    console.log('Using example recipes as fallback...');
    return [
      {
        name: "Create a Birch Plank (Scrap)",
        output: "Birch Plank",
        requirements: {
          profession: {
            name: "Carpentry",
            level: 1
          },
          materials: [
            {
              name: "Wood Scrap",
              amount: 5
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
            level: 1
          },
          materials: [
            {
              name: "Stone",
              amount: 2
            },
            {
              name: "Wooden Stick",
              amount: 1
            }
          ]
        }
      }
    ];
  }

  return recipes;
}

async function generateRecipesJson() {
  console.log('Starting recipe generation...');

  const recipes = await fetchRecipesFromWiki();

  // Write to recipes.json
  const outputPath = 'src/data/recipes.json';
  writeFileSync(outputPath, JSON.stringify(recipes, null, 4), 'utf8');

  console.log(`Successfully generated ${recipes.length} recipes in ${outputPath}`);
}

// Run the script
generateRecipesJson().catch(console.error);
