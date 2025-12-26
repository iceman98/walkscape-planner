<script lang="ts">
  import { browser } from "$app/environment";
  import { Stage, Layer, Group, Text, Rect, Image } from "svelte-konva";

  import character from "../data/character.json";
  import recipes from "../data/recipes.json";
  import icons from "../lib/assets/icons.json";

  // Skill experience table (level -> required XP)
  const skillLevels: Record<number, number> = {
    1: 0, 2: 83, 3: 174, 4: 276, 5: 388, 6: 512, 7: 650, 8: 801, 9: 969, 10: 1154,
    11: 1358, 12: 1584, 13: 1833, 14: 2107, 15: 2411, 16: 2746, 17: 3115, 18: 3523, 19: 3973, 20: 4470,
    21: 5018, 22: 5624, 23: 6291, 24: 7028, 25: 7842, 26: 8740, 27: 9730, 28: 10824, 29: 12031, 30: 13363,
    31: 14833, 32: 16456, 33: 18247, 34: 20224, 35: 22406, 36: 24815, 37: 27473, 38: 30408, 39: 33648, 40: 37224,
    41: 41171, 42: 45529, 43: 50339, 44: 55649, 45: 61512, 46: 67983, 47: 75127, 48: 83014, 49: 91721, 50: 101333,
    51: 111945, 52: 123660, 53: 136594, 54: 150872, 55: 166636, 56: 184040, 57: 203254, 58: 224466, 59: 247886, 60: 273742,
    61: 302288, 62: 333804, 63: 368599, 64: 407015, 65: 449428, 66: 496254, 67: 547953, 68: 605032, 69: 668051, 70: 737627,
    71: 814445, 72: 899257, 73: 992895, 74: 1096278, 75: 1210421, 76: 1336443, 77: 1475581, 78: 1629200, 79: 1798808, 80: 1986068,
    81: 2192818, 82: 2421087, 83: 2673114, 84: 2951373, 85: 3258594, 86: 3597792, 87: 3972294, 88: 4385776, 89: 4842295, 90: 5346332,
    91: 5902831, 92: 6517253, 93: 7195629, 94: 7944614, 95: 8771558, 96: 9684577, 97: 10692629, 98: 11805606, 99: 13034431
  };

  let stageRef: any;
  let scale = 1;
  let stagePos = { x: 0, y: 0 };
  let stageContainer: HTMLButtonElement;
  let stageOffset = { x: 0, y: 0 }; // Track stage position for zoom centering
  let isDragging = false;
  let dragStartPos = { x: 0, y: 0 };
  let dragStartStagePos = { x: 0, y: 0 };

  // Cache for loaded images
  const loadedImages: Record<string, HTMLImageElement> = {};

  // Type definitions
  type IconsType = {
    materials: Record<string, string>;
    professions: Record<string, string>;
  };

  // Cast icons to proper type
  const typedIcons: IconsType = icons as IconsType;

  // Simple function to load an image
  async function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = document.createElement('img') as HTMLImageElement;
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // Load all icons on component mount
  import { onMount } from 'svelte';
  
  onMount(() => {
    // Load all material icons
    const loadMaterialIcons = async () => {
      for (const [name, path] of Object.entries(typedIcons.materials)) {
        const url = `/src/lib/assets/${path.substring(2)}`;
        const img = await loadImage(url);
        if (img) loadedImages[path] = img;
      }
    };
    
    // Load all profession icons
    const loadProfessionIcons = async () => {
      for (const [name, path] of Object.entries(typedIcons.professions)) {
        const url = `/src/lib/assets/${path.substring(2)}`;
        const img = await loadImage(url);
        if (img) loadedImages[path] = img;
      }
    };

    // Add global mouse event listeners
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      
      stageOffset.x = dragStartStagePos.x + dx;
      stageOffset.y = dragStartStagePos.y + dy;
    };

    const handleGlobalMouseUp = () => {
      isDragging = false;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    // Load icons
    loadMaterialIcons();
    loadProfessionIcons();

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  });

  // Group recipes by profession and sort by level then alphabetically
  $: groupedRecipes = recipes.reduce((acc: Record<string, any[]>, recipe) => {
    const profession = recipe.requirements.profession.name;
    if (!acc[profession]) {
      acc[profession] = [];
    }
    acc[profession].push(recipe);
    return acc;
  }, {});

  // Sort each profession's recipes by level then name
  $: sortedGroupedRecipes = Object.keys(groupedRecipes).reduce((acc: Record<string, any[]>, profession) => {
    acc[profession] = groupedRecipes[profession].sort((a, b) => {
      const levelDiff = a.requirements.profession.level - b.requirements.profession.level;
      if (levelDiff !== 0) return levelDiff;
      return a.name.localeCompare(b.name);
    });
    return acc;
  }, {});

  // Calculate X positions for each profession in columns
  $: professionPositions = Object.keys(sortedGroupedRecipes).reduce((acc: Record<string, {x: number, y: number}>, profession, index) => {
    const columns = 5; // Number of columns
    const columnWidth = 420; // Width per column including spacing
    const column = index % columns;
    const row = Math.floor(index / columns);
    
    acc[profession] = {
      x: 10 + column * columnWidth,
      y: row * 600 // Start new row after 3 professions
    };
    return acc;
  }, {});

  // Function to convert XP to level
  function xpToLevel(xp: number): number {
    for (let level = 99; level >= 1; level--) {
      if (xp >= skillLevels[level]) {
        return level;
      }
    }
    return 1;
  }

  // Function to get character skill level
  function getSkillLevel(skillName: string): number {
    const skillXp = character.skills[skillName as keyof typeof character.skills] || 0;
    return xpToLevel(skillXp);
  }

  // Function to normalize item names to match icons.json
  function normalizeItemName(name: string): string {
    // Handle fine quality items (e.g., "coal_fine" -> "Fine Coal")
    if (name.endsWith('_fine')) {
      const baseName = name.slice(0, -5); // Remove '_fine'
      const normalizedBase = baseName.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      return `Fine ${normalizedBase}`;
    }
    
    // Convert snake_case to Title Case (e.g., "spruce_plank" -> "Spruce Plank")
    return name.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  // Function to get material availability info
  function getMaterialAvailability(materialName: string, amount: number, inventory: Record<string, { normal: number; fine: number }>) {
    const inventoryName = recipeNameToInventoryName(materialName);
    const available = inventory[inventoryName] || { normal: 0, fine: 0 };
    
    return {
      normal: available.normal,
      fine: available.fine,
      canCraftNormal: available.normal >= amount,
      canCraftFine: available.fine >= amount,
      shortageNormal: Math.max(0, amount - available.normal),
      shortageFine: Math.max(0, amount - available.fine)
    };
  }

  // Function to convert recipe name to inventory snake_case format
  function recipeNameToInventoryName(recipeName: string): string {
    return recipeName.toLowerCase().replace(/\s+/g, '_');
  }

  // Calculate how many times a recipe can be crafted
  function calculateCraftingTimes(recipe: any, inventory: Record<string, { normal: number; fine: number }>) {
    // Check if character has required skill level
    const requiredLevel = recipe.requirements.profession.level;
    const skillName = recipe.requirements.profession.name.toLowerCase();
    const currentLevel = getSkillLevel(skillName);
    const hasRequiredLevel = currentLevel >= requiredLevel;
    
    if (!hasRequiredLevel) {
      return {
        normal: 0,
        fine: 0,
        canCraftNormal: false,
        canCraftFine: false,
        missingLevel: requiredLevel - currentLevel
      };
    }
    
    const normalTimes = Math.min(...recipe.requirements.materials.map((material: any) => {
      const inventoryName = recipeNameToInventoryName(material.name);
      const available = inventory[inventoryName] || { normal: 0, fine: 0 };
      return Math.floor(available.normal / material.amount);
    }));
    
    const fineTimes = Math.min(...recipe.requirements.materials.map((material: any) => {
      const inventoryName = recipeNameToInventoryName(material.name);
      const available = inventory[inventoryName] || { normal: 0, fine: 0 };
      return Math.floor(available.fine / material.amount);
    }));
    
    return {
      normal: normalTimes || 0,
      fine: fineTimes || 0,
      canCraftNormal: normalTimes > 0,
      canCraftFine: fineTimes > 0,
      missingLevel: 0
    };
  }

  // Get inventory items as array (including bank)
  $: inventoryItems = (() => {
    const allItems: Record<string, { normal: number; fine: number }> = {};
    
    // Process inventory items
    Object.entries(character.inventory).forEach(([name, quantity]) => {
      let baseName = name;
      let isFine = false;
      
      if (name.endsWith('_fine')) {
        baseName = name.slice(0, -5); // Remove '_fine'
        isFine = true;
      }
      
      if (!allItems[baseName]) {
        allItems[baseName] = { normal: 0, fine: 0 };
      }
      
      if (isFine) {
        allItems[baseName].fine += quantity;
      } else {
        allItems[baseName].normal += quantity;
      }
    });
    
    // Process bank items
    Object.entries(character.bank).forEach(([name, quantity]) => {
      let baseName = name;
      let isFine = false;
      
      if (name.endsWith('_fine')) {
        baseName = name.slice(0, -5); // Remove '_fine'
        isFine = true;
      }
      
      if (!allItems[baseName]) {
        allItems[baseName] = { normal: 0, fine: 0 };
      }
      
      if (isFine) {
        allItems[baseName].fine += quantity;
      } else {
        allItems[baseName].normal += quantity;
      }
    });
    
    return Object.entries(allItems).map(([baseName, quantities]) => {
      const normalizedName = normalizeItemName(baseName);
      
      return {
        name: normalizedName,
        normalQuantity: quantities.normal,
        fineQuantity: quantities.fine,
        icon: typedIcons.materials[normalizedName],
        hasFine: quantities.fine > 0
      };
    });
  })();

  // Calculate crafting times for all recipes
  $: recipesWithCraftingInfo = sortedGroupedRecipes && Object.keys(sortedGroupedRecipes).reduce((acc: Record<string, any[]>, profession) => {
    acc[profession] = sortedGroupedRecipes[profession].map((recipe: any) => {
      const inventoryMap: Record<string, { normal: number; fine: number }> = {};
    inventoryItems.forEach(item => {
      const snakeCaseName = recipeNameToInventoryName(item.name);
      inventoryMap[snakeCaseName] = { normal: item.normalQuantity, fine: item.fineQuantity };
    });
      
      const craftingTimes = calculateCraftingTimes(recipe, inventoryMap);
      
      return {
        ...recipe,
        craftingTimes,
        canCraft: craftingTimes.normal > 0 || craftingTimes.fine > 0,
        inventoryMap // Pass inventoryMap to template
      };
    });
    return acc;
  }, {});

  function handleWheel(e: { evt: WheelEvent }) {
    if (!stageRef) return;
    
    e.evt.preventDefault();
    
    const scaleBy = 1.1;
    const oldScale = stageRef.scaleX();
    const pointer = stageRef.getPointerPosition();
    
    if (!pointer) return;
    
    // Calculate the new scale
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // Limit scale
    if (newScale < 0.5 || newScale > 5) return;

    // Calculate the new position to keep the pointer in the same place
    const mousePointTo = {
      x: (pointer.x - stageRef.x()) / oldScale,
      y: (pointer.y - stageRef.y()) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    // Apply the new scale and position
    stageRef.scaleX(newScale);
    stageRef.scaleY(newScale);
    stageRef.x(newPos.x);
    stageRef.y(newPos.y);
    stageRef.batchDraw();
    
    // Update the scale variable for Svelte reactivity
    scale = newScale;
  }

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    dragStartPos = { x: e.clientX, y: e.clientY };
    dragStartStagePos = { x: stageOffset.x, y: stageOffset.y };
  }

  function handleMouseMove(e: { evt: MouseEvent }) {
    if (!isDragging) return;
    
    const dx = e.evt.clientX - dragStartPos.x;
    const dy = e.evt.clientY - dragStartPos.y;
    
    stageOffset.x = dragStartStagePos.x + dx;
    stageOffset.y = dragStartStagePos.y + dy;
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function handleZoom(scaleFactor: number) {
    if (!stageRef) return;
    
    const oldScale = stageRef.scaleX();
    const newScale = oldScale * scaleFactor;
    
    // Limit scale
    if (newScale < 0.5 || newScale > 5) return;
    
    // Get stage center position
    const stageCenterX = stageRef.width() / 2;
    const stageCenterY = stageRef.height() / 2;
    
    // Calculate the new position to keep the center fixed
    const mousePointTo = {
      x: (stageCenterX - stageRef.x()) / oldScale,
      y: (stageCenterY - stageRef.y()) / oldScale,
    };

    const newPos = {
      x: stageCenterX - mousePointTo.x * newScale,
      y: stageCenterY - mousePointTo.y * newScale,
    };

    // Apply the new scale and position
    stageRef.scaleX(newScale);
    stageRef.scaleY(newScale);
    stageRef.x(newPos.x);
    stageRef.y(newPos.y);
    stageRef.batchDraw();
    
    // Update the scale variable for Svelte reactivity
    scale = newScale;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!stageRef) return;
    
    const step = 10;
    switch(e.key) {
      case 'ArrowUp':
        e.preventDefault();
        stageOffset.y += step;
        break;
      case 'ArrowDown':
        e.preventDefault();
        stageOffset.y -= step;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        stageOffset.x += step;
        break;
      case 'ArrowRight':
        e.preventDefault();
        stageOffset.x -= step;
        break;
      case '+':
      case '=':
        e.preventDefault();
        handleZoom(1.1);
        break;
      case '-':
      case '_':
        e.preventDefault();
        handleZoom(0.9);
        break;
    }
  }

  // Canvas action to draw icons
  function canvasIcon(node: HTMLCanvasElement, icon: HTMLImageElement) {
    const ctx = node.getContext('2d');
    if (!ctx) return;

    // Draw the icon
    ctx.drawImage(icon, 0, 0, 30, 30);
  }

  function handleNativeWheel(e: WheelEvent) {
    if (!stageRef) return;
    
    e.preventDefault();
    
    const scaleBy = 1.1;
    const oldScale = scale;
    
    // Get mouse position relative to the container
    const rect = stageContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newScale = e.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // Limit scale
    if (newScale < 0.5 || newScale > 5) return;
    
    // Calculate the offset to keep the mouse position fixed
    const scaleChange = newScale - oldScale;
    const offsetX = -(mouseX - stageOffset.x) * scaleChange / oldScale;
    const offsetY = -(mouseY - stageOffset.y) * scaleChange / oldScale;
    
    // Update scale and offset
    scale = newScale;
    stageOffset.x += offsetX;
    stageOffset.y += offsetY;
  }
</script>

{#if browser}
  <div class="container">
    <!-- Inventory Panel -->
    <div class="inventory-panel">
      <h3>Inventario</h3>
      <div class="inventory-grid">
        {#each inventoryItems as item}
          <div class="inventory-item" class:has-fine={item.hasFine}>
            {#if item.icon && loadedImages[item.icon]}
              {@const itemIcon = loadedImages[item.icon]}
              {#if itemIcon}
                <div class="item-icon-container">
                  <canvas 
                    width={30} 
                    height={30} 
                    class="item-icon-canvas"
                    use:canvasIcon={itemIcon}
                  ></canvas>
                </div>
              {/if}
            {/if}
            <div class="item-info">
              <div class="item-name" class:fine-name={item.hasFine}>{item.name}</div>
              <div class="item-quantities">
                {#if item.normalQuantity > 0}
                  <div class="quantity-normal">x{item.normalQuantity}</div>
                {/if}
                {#if item.fineQuantity > 0}
                  <div class="quantity-fine">x{item.fineQuantity} fine</div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
    
    <!-- Recipe Canvas -->
    <button bind:this={stageContainer} on:wheel={handleNativeWheel} on:mousedown={handleMouseDown} on:keydown={handleKeyDown} class="recipe-canvas" aria-label="Recipe planning canvas">
      <Stage 
        bind:this={stageRef}
        width={window.innerWidth - 320} 
        height={window.innerHeight}
        scaleX={scale}
        scaleY={scale}
        x={stageOffset.x}
        y={stageOffset.y}
      >
    <Layer>
      {#each Object.entries(recipesWithCraftingInfo) as [profession, professionRecipes]}
        <Group x={professionPositions[profession]?.x || 0} y={professionPositions[profession]?.y || 0}>
          <!-- Profession header -->
          <Rect x={0} y={0} width={280} height={50} fill="darkblue" />
          <Text text={profession} x={10} y={15} color="white" fontSize={18} />
          
          <!-- Profession icon -->
          {#if typedIcons.professions[profession]}
            {@const professionIcon = loadedImages[typedIcons.professions[profession]]}
            {#if professionIcon}
              <Image
                image={professionIcon}
                x={250}
                y={10}
                width={30}
                height={30}
              />
            {/if}
          {/if}
          
          <!-- Recipes for this profession -->
          {#each professionRecipes as recipe, recipeIndex}
            {@const recipeY = 60 + recipeIndex * 120}
            <Group x={0} y={recipeY}>
              <!-- Recipe card background with different border colors -->
              <Rect 
                x={0} 
                y={0} 
                width={380} 
                height={110} 
                fill="lightgrey" 
                stroke={recipe.craftingTimes.missingLevel > 0 ? "#FF9800" : recipe.canCraft ? "#4CAF50" : "black"} 
                strokeWidth={recipe.craftingTimes.missingLevel > 0 || recipe.canCraft ? 3 : 1} 
              />
              
              <!-- Recipe output icon -->
              {#if typedIcons.materials[recipe.output]}
                {@const outputIcon = loadedImages[typedIcons.materials[recipe.output]]}
                {#if outputIcon}
                  <Image
                    image={outputIcon}
                    x={10}
                    y={15}
                    width={40}
                    height={40}
                  />
                {/if}
              {/if}
              
              <!-- Recipe info -->
              <Group x={60} y={5}>
                <Text text={recipe.name} x={0} y={0} fontSize={12} fontWeight="bold" />
                <Text text={`Output: ${recipe.output}`} x={0} y={15} fontSize={10} />
                
                <!-- Crafting times -->
                <Group x={0} y={30}>
                  {#if recipe.craftingTimes.missingLevel > 0}
                    <Text text={`Need Lv${recipe.craftingTimes.missingLevel + getSkillLevel(recipe.requirements.profession.name.toLowerCase())} more`} x={0} y={0} fontSize={9} fill="#FF9800" />
                  {:else if recipe.craftingTimes.normal > 0}
                    <Text text={`Normal: x${recipe.craftingTimes.normal}`} x={0} y={0} fontSize={9} fill="#4CAF50" />
                  {/if}
                  {#if recipe.craftingTimes.missingLevel > 0}
                    <Text text={`Current: Lv${getSkillLevel(recipe.requirements.profession.name.toLowerCase())}`} x={80} y={0} fontSize={9} fill="#9C27B0" />
                  {:else if recipe.craftingTimes.fine > 0}
                    <Text text={`Fine: x${recipe.craftingTimes.fine}`} x={80} y={0} fontSize={9} fill="#2196F3" />
                  {/if}
                  {#if recipe.craftingTimes.missingLevel === 0 && recipe.craftingTimes.normal === 0 && recipe.craftingTimes.fine === 0}
                    <Text text="No materials" x={0} y={0} fontSize={9} fill="#F44336" />
                  {/if}
                </Group>
                
                <!-- Materials -->
                <Group x={0} y={45}>
                  <Text text="Materials:" x={0} y={0} fontSize={10} fontWeight="bold" />
                  {#if recipe.requirements && recipe.requirements.materials && recipe.requirements.materials.length > 0}
                    {#each recipe.requirements.materials as material, matIndex}
                      {@const matX = matIndex * 120}
                      {@const availability = getMaterialAvailability(material.name, material.amount, recipe.inventoryMap)}
                      <Group x={matX} y={10}>
                        {#if typedIcons.materials[material.name]}
                          {@const matIcon = loadedImages[typedIcons.materials[material.name]]}
                          {#if matIcon}
                            <Image
                              image={matIcon}
                              x={0}
                              y={0}
                              width={20}
                              height={20}
                            />
                          {/if}
                        {/if}
                        <Text text={material.name} x={0} y={22} fontSize={7} textAnchor="middle" />
                        <Text text={`x${material.amount}`} x={0} y={30} fontSize={7} textAnchor="middle" fontWeight="bold" />
                        <Text text={`have ${availability.normal}N / ${availability.fine}F`} x={0} y={37} fontSize={6} textAnchor="middle" 
                          fill={availability.canCraftNormal ? "#4CAF50" : availability.canCraftFine ? "#2196F3" : "#F44336"} />
                      </Group>
                    {/each}
                  {:else if recipe.requirements && recipe.requirements.materials && recipe.requirements.materials.length === 0}
                    <Text text="No materials defined" x={0} y={15} fontSize={8} fill="#999" />
                  {:else}
                    <Text text="No materials property" x={0} y={15} fontSize={8} fill="#999" />
                  {/if}
                </Group>
              </Group>
              
              <!-- Level indicator -->
              <Rect x={350} y={5} width={40} height={20} fill="orange" />
              <Text text={`Lv${recipe.requirements.profession.level}`} x={370} y={18} fontSize={10} textAnchor="middle" color="white" />
            </Group>
          {/each}
        </Group>
      {/each}
    </Layer>
  </Stage>
    </button>
  </div>
{/if}

<style>
  .container {
    display: flex;
    height: 100vh;
  }

  .inventory-panel {
    width: 300px;
    background: #f5f5f5;
    border-right: 1px solid #ccc;
    overflow-y: auto;
    padding: 20px;
  }

  .inventory-panel h3 {
    margin: 0 0 20px 0;
    color: #333;
    font-size: 18px;
    font-weight: bold;
  }

  .inventory-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .inventory-item {
    display: flex;
    align-items: center;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px;
    min-height: 50px;
  }

  .inventory-item.has-fine {
    background: #f0f8ff;
    border-color: #4a90e2;
  }

  .item-icon-container {
    width: 30px;
    height: 30px;
    margin-right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .item-icon-canvas {
    width: 30px;
    height: 30px;
    object-fit: contain;
  }

  .item-info {
    flex: 1;
  }

  .item-name {
    font-size: 12px;
    font-weight: 500;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-name.fine-name {
    color: #4a90e2;
    font-weight: 600;
  }

  .item-quantities {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .quantity-normal {
    font-size: 11px;
    color: #666;
    font-weight: bold;
  }

  .quantity-fine {
    font-size: 10px;
    color: #4a90e2;
    font-weight: bold;
  }

  .recipe-canvas {
    flex: 1;
    position: relative;
  }
</style>
