<script lang="ts">
  import { browser } from "$app/environment";
  import { Stage, Layer, Group, Text, Rect, Image } from "svelte-konva";
  import "../lib/constants.css";

  import character from "../data/character.json";
  import recipes from "../data/recipes.json";
  import icons from "../lib/assets/icons.json";
  import { 
    UI_CONSTANTS, 
    COLORS, 
    FONT_SIZES, 
    SPACING, 
    ANIMATIONS, 
    STORAGE_KEYS, 
    SKILL_LEVELS 
  } from "../lib/constants";

  // Load character from localStorage or use default
  let characterData = character;
  let showImportDialog = false;
  let importText = "";
  let importError = "";

  // Load saved character from localStorage on mount
  if (typeof window !== 'undefined') {
    const savedCharacter = localStorage.getItem(STORAGE_KEYS.CHARACTER);
    if (savedCharacter) {
      try {
        characterData = JSON.parse(savedCharacter);
      } catch (e) {
        console.error('Error loading saved character:', e);
      }
    }
  }

  // Function to convert XP to level
  function xpToLevel(xp: number): number {
    for (let level = 99; level >= 1; level--) {
      if (xp >= SKILL_LEVELS[level]) {
        return level;
      }
    }
    return 1;
  }

  let stageRef: any;
  let scale = 1;
  let stagePos = { x: 0, y: 0 };
  let stageContainer: HTMLButtonElement;
  let stageOffset = { x: 0, y: 0 }; // Track stage position for zoom centering
  let isDragging = false;
  let dragStartPos = { x: 0, y: 0 };
  let dragStartStagePos = { x: 0, y: 0 };
  let showOnlyCraftable = false; // Toggle for craftable recipes only

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

  // Function to get character skill level
  function getSkillLevel(skillName: string): number {
    const skillXp = characterData.skills[skillName as keyof typeof characterData.skills] || 0;
    return xpToLevel(skillXp);
  }

  // Import character JSON
  function importCharacter() {
    importError = "";
    try {
      const newCharacter = JSON.parse(importText);
      
      // Validate basic structure
      if (!newCharacter.skills || typeof newCharacter.skills !== 'object') {
        importError = "El JSON debe contener un objeto 'skills'";
        return;
      }
      
      if (!newCharacter.inventory || typeof newCharacter.inventory !== 'object') {
        importError = "El JSON debe contener un objeto 'inventory'";
        return;
      }
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CHARACTER, JSON.stringify(newCharacter));
      }
      
      // Update character data and trigger re-render
      characterData = newCharacter;
      showImportDialog = false;
      importText = "";
      
    } catch (e) {
      importError = "JSON inválido. Por favor, verifica el formato.";
    }
  }

  // Reset to default character
  function resetCharacter() {
    characterData = character;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.CHARACTER);
    }
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
  const allItems: Record<string, { normalQuantity: number; fineQuantity: number; icon: any; hasFine: boolean }> = {};
  
  // Process inventory items
  Object.entries(characterData.inventory).forEach(([name, quantity]) => {
    let baseName = name;
    let fineQuantity = 0;
    let normalQuantity = quantity;
    
    // Check if this is a fine quality item
    if (name.endsWith('_fine')) {
      baseName = name.slice(0, -5); // Remove '_fine'
      fineQuantity = quantity;
      normalQuantity = 0;
    }
    
    const normalizedName = normalizeItemName(baseName);
    
    if (allItems[normalizedName]) {
      allItems[normalizedName].normalQuantity += normalQuantity;
      allItems[normalizedName].fineQuantity += fineQuantity;
    } else {
      allItems[normalizedName] = {
        normalQuantity,
        fineQuantity,
        icon: typedIcons.materials[normalizedName],
        hasFine: fineQuantity > 0
      };
    }
  });
  
  // Process bank items
  if (characterData.bank) {
    Object.entries(characterData.bank).forEach(([name, quantity]) => {
      let baseName = name;
      let fineQuantity = 0;
      let normalQuantity = quantity;
      
      // Check if this is a fine quality item
      if (name.endsWith('_fine')) {
        baseName = name.slice(0, -5); // Remove '_fine'
        fineQuantity = quantity;
        normalQuantity = 0;
      }
      
      const normalizedName = normalizeItemName(baseName);
      
      if (allItems[normalizedName]) {
        allItems[normalizedName].normalQuantity += normalQuantity;
        allItems[normalizedName].fineQuantity += fineQuantity;
      } else {
        allItems[normalizedName] = {
          normalQuantity,
          fineQuantity,
          icon: typedIcons.materials[normalizedName],
          hasFine: fineQuantity > 0
        };
      }
    });
  }
  
  // Convert to array and sort by name
  return Object.entries(allItems)
    .map(([name, quantities]) => ({
      name,
      ...quantities
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
})();

// Calculate crafting times for all recipes
$: recipesWithCraftingInfo = sortedGroupedRecipes && Object.keys(sortedGroupedRecipes).reduce((acc: Record<string, any[]>, profession) => {
  acc[profession] = sortedGroupedRecipes[profession].map((recipe: any) => {
    const inventoryMap: Record<string, { normal: number; fine: number }> = {};
    inventoryItems.forEach((item: any) => {
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
  }).filter((recipe: any) => {
    // Filter recipes based on toggle
    if (!showOnlyCraftable) return true;
    return recipe.canCraft && recipe.craftingTimes.missingLevel === 0;
  });
  return acc;
}, {});

  function handleWheel(e: { evt: WheelEvent }) {
    if (!stageRef) return;
    
    e.evt.preventDefault();
    
    const scaleBy = UI_CONSTANTS.SCALE_FACTOR;
    const oldScale = stageRef.scaleX();
    const pointer = stageRef.getPointerPosition();
    
    if (!pointer) return;
    
    // Calculate the new scale
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // Limit scale
    if (newScale < UI_CONSTANTS.MIN_SCALE || newScale > UI_CONSTANTS.MAX_SCALE) return;

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
    
    const scaleBy = UI_CONSTANTS.SCALE_FACTOR;
    const oldScale = scale;
    
    // Get mouse position relative to the container
    const rect = stageContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newScale = e.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // Limit scale
    if (newScale < UI_CONSTANTS.MIN_SCALE || newScale > UI_CONSTANTS.MAX_SCALE) return;
    
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
      <div class="panel-header">
        <h3>Inventario</h3>
        <div class="panel-buttons">
          <button class="import-btn" on:click={() => showImportDialog = true}>
            Importar Personaje
          </button>
          <button class="reset-btn" on:click={resetCharacter}>
            Restablecer
          </button>
        </div>
      </div>
      
      <!-- Toggle for craftable recipes only -->
      <div class="toggle-container">
        <label class="toggle-label">
          <input 
            type="checkbox" 
            bind:checked={showOnlyCraftable} 
            class="toggle-input"
          />
          <span class="toggle-slider"></span>
          <span class="toggle-text">Mostrar solo recetas posibles</span>
        </label>
      </div>
      
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
        width={window.innerWidth - UI_CONSTANTS.INVENTORY_PANEL_WIDTH} 
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
          <Rect x={0} y={0} width={UI_CONSTANTS.PROFESSION_HEADER_WIDTH} height={UI_CONSTANTS.PROFESSION_HEADER_HEIGHT} fill={COLORS.PROFESSION_HEADER} />
          
          <!-- Profession icon or placeholder -->
          {#if typedIcons.professions[profession] && loadedImages[typedIcons.professions[profession]]}
            {@const professionIcon = loadedImages[typedIcons.professions[profession]]}
            <Image
              image={professionIcon}
              x={UI_CONSTANTS.PROFESSION_ICON_MARGIN}
              y={UI_CONSTANTS.PROFESSION_ICON_MARGIN}
              width={UI_CONSTANTS.PROFESSION_ICON_SIZE}
              height={UI_CONSTANTS.PROFESSION_ICON_SIZE}
            />
          {:else}
            <!-- Placeholder circle when no icon is available -->
            <Rect x={UI_CONSTANTS.PROFESSION_ICON_MARGIN} y={UI_CONSTANTS.PROFESSION_ICON_MARGIN} width={UI_CONSTANTS.PROFESSION_ICON_SIZE} height={UI_CONSTANTS.PROFESSION_ICON_SIZE} fill={COLORS.PLACEHOLDER_BACKGROUND} rx={5} />
            <Text text={profession.charAt(0)} x={SPACING.PLACEHOLDER_TEXT_X} y={SPACING.PLACEHOLDER_TEXT_Y} color={COLORS.TEXT_WHITE} fontSize={FONT_SIZES.PROFESSION_HEADER} textAnchor="middle" fontWeight="bold" />
          {/if}
          
          <Text text={profession} x={SPACING.PROFESSION_TEXT_X} y={SPACING.PROFESSION_TEXT_Y} color={COLORS.TEXT_WHITE} fontSize={FONT_SIZES.PROFESSION_HEADER} />
          
          <!-- Recipes for this profession -->
          {#each professionRecipes as recipe, recipeIndex}
            {@const recipeY = UI_CONSTANTS.PROFESSION_HEADER_HEIGHT + recipeIndex * UI_CONSTANTS.RECIPE_CARD_SPACING}
            <Group x={0} y={recipeY}>
              <!-- Recipe card background with different border colors -->
              <Rect 
                x={0} 
                y={0} 
                width={UI_CONSTANTS.RECIPE_CARD_WIDTH} 
                height={UI_CONSTANTS.RECIPE_CARD_HEIGHT} 
                fill={COLORS.RECIPE_CARD_BACKGROUND} 
                stroke={recipe.craftingTimes.missingLevel > 0 ? COLORS.BORDER_MISSING_LEVEL : recipe.canCraft ? COLORS.BORDER_CRAFTABLE : COLORS.BORDER_DEFAULT} 
                strokeWidth={recipe.craftingTimes.missingLevel > 0 || recipe.canCraft ? COLORS.BORDER_WIDTH_CRAFTABLE : COLORS.BORDER_WIDTH_DEFAULT} 
              />
              
              <!-- Recipe output icon -->
              {#if typedIcons.materials[recipe.output]}
                {@const outputIcon = loadedImages[typedIcons.materials[recipe.output]]}
                {#if outputIcon}
                  <Image
                    image={outputIcon}
                    x={UI_CONSTANTS.OUTPUT_ICON_MARGIN}
                    y={UI_CONSTANTS.OUTPUT_ICON_MARGIN}
                    width={UI_CONSTANTS.OUTPUT_ICON_SIZE}
                    height={UI_CONSTANTS.OUTPUT_ICON_SIZE}
                  />
                {/if}
              {/if}
              
              <!-- Recipe info -->
              <Group x={SPACING.RECIPE_INFO_X} y={SPACING.RECIPE_INFO_Y}>
                <Text text={recipe.output} x={0} y={SPACING.RECIPE_NAME_Y} fontSize={FONT_SIZES.RECIPE_NAME} />
                <Text text="x1" x={0} y={SPACING.RECIPE_AMOUNT_Y} fontSize={FONT_SIZES.RECIPE_OUTPUT} />
                
                <!-- Crafting times -->
                <Group y={SPACING.CRAFTING_TIMES_Y}>
                  {#if recipe.craftingTimes.missingLevel > 0}
                    <Text text={`Need Lv${recipe.craftingTimes.missingLevel + getSkillLevel(recipe.requirements.profession.name.toLowerCase())} more`} x={SPACING.CRAFTING_STATUS_X_LEFT} y={0} fontSize={FONT_SIZES.CRAFTING_STATUS} fill={COLORS.CRAFTING_MISSING_LEVEL} />
                  {:else if recipe.craftingTimes.normal > 0}
                    <Text text={`Normal: x${recipe.craftingTimes.normal}`} x={SPACING.CRAFTING_STATUS_X_LEFT} y={0} fontSize={FONT_SIZES.CRAFTING_STATUS} fill={COLORS.CRAFTING_NORMAL} />
                  {/if}
                  {#if recipe.craftingTimes.missingLevel > 0}
                    <Text text={`Current: Lv${getSkillLevel(recipe.requirements.profession.name.toLowerCase())}`} x={SPACING.CRAFTING_STATUS_X_RIGHT} y={0} fontSize={FONT_SIZES.CRAFTING_STATUS} fill={COLORS.CRAFTING_CURRENT_LEVEL} />
                  {:else if recipe.craftingTimes.fine > 0}
                    <Text text={`Fine: x${recipe.craftingTimes.fine}`} x={SPACING.CRAFTING_STATUS_X_RIGHT} y={0} fontSize={FONT_SIZES.CRAFTING_STATUS} fill={COLORS.CRAFTING_FINE} />
                  {/if}
                  {#if recipe.craftingTimes.missingLevel === 0 && recipe.craftingTimes.normal === 0 && recipe.craftingTimes.fine === 0}
                    <Text text="No materials" x={SPACING.CRAFTING_STATUS_X_LEFT} y={0} fontSize={FONT_SIZES.CRAFTING_STATUS} fill={COLORS.CRAFTING_NO_MATERIALS} />
                  {/if}
                </Group>
                
                <!-- Materials -->
                <Group y={SPACING.MATERIALS_Y}>
                  {#if recipe.requirements.materials && recipe.requirements.materials.length > 0}
                    {#each recipe.requirements.materials as material, materialIndex}
                      {@const materialX = materialIndex * UI_CONSTANTS.MATERIAL_ICON_SPACING}
                      {@const availability = recipe.inventoryMap[recipeNameToInventoryName(material.name)] || { normal: 0, fine: 0 }}
                      <Group x={materialX} y={SPACING.MATERIAL_Y_OFFSET}>
                        {#if typedIcons.materials[material.name]}
                          {@const materialIcon = loadedImages[typedIcons.materials[material.name]]}
                          {#if materialIcon}
                            <Image
                              image={materialIcon}
                              x={0}
                              y={0}
                              width={UI_CONSTANTS.MATERIAL_ICON_SIZE}
                              height={UI_CONSTANTS.MATERIAL_ICON_SIZE}
                            />
                          {/if}
                        {/if}
                        <Text text={material.name} x={0} y={SPACING.MATERIAL_TEXT_Y} fontSize={FONT_SIZES.MATERIAL_NAME} textAnchor="middle" />
                        <Text text={`x${material.amount}`} x={0} y={SPACING.MATERIAL_AMOUNT_Y} fontSize={FONT_SIZES.MATERIAL_AMOUNT} textAnchor="middle" fontWeight="bold" />
                        <Text text={`have ${availability.normal}N / ${availability.fine}F`} x={0} y={SPACING.MATERIAL_AVAILABILITY_Y} fontSize={FONT_SIZES.MATERIAL_AVAILABILITY} textAnchor="middle" 
                              fill={availability.normal >= material.amount ? COLORS.AVAILABILITY_CAN_CRAFT : availability.fine >= material.amount ? COLORS.AVAILABILITY_CAN_CRAFT_FINE : COLORS.AVAILABILITY_CANNOT_CRAFT} />
                      </Group>
                    {/each}
                  {:else if recipe.requirements.materials}
                    <Text text="No materials defined" x={0} y={SPACING.MATERIAL_Y_OFFSET} fontSize={FONT_SIZES.MATERIAL_NAME} fill="#999" />
                  {:else}
                    <Text text="No materials property" x={0} y={SPACING.MATERIAL_Y_OFFSET} fontSize={FONT_SIZES.MATERIAL_NAME} fill="#999" />
                  {/if}
                </Group>
              </Group>
              
              <!-- Level indicator -->
              <Rect x={UI_CONSTANTS.LEVEL_INDICATOR_X} y={UI_CONSTANTS.LEVEL_INDICATOR_Y} width={UI_CONSTANTS.LEVEL_INDICATOR_WIDTH} height={UI_CONSTANTS.LEVEL_INDICATOR_HEIGHT} fill={COLORS.LEVEL_INDICATOR_BACKGROUND} />
              <Text text={`Lv${recipe.requirements.profession.level}`} x={SPACING.LEVEL_TEXT_X} y={SPACING.LEVEL_TEXT_Y} fontSize={FONT_SIZES.LEVEL_INDICATOR} textAnchor="middle" color={COLORS.LEVEL_INDICATOR_TEXT} />
            </Group>
          {/each}
        </Group>
      {/each}
    </Layer>
  </Stage>
    </button>
    
    <!-- Import Dialog -->
    {#if showImportDialog}
      <div 
        class="dialog-overlay" 
        role="button" 
        tabindex="0"
        on:click={(e) => {
          if (e.target === e.currentTarget) {
            showImportDialog = false;
          }
        }}
        on:keydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showImportDialog = false;
          }
        }}
        aria-label="Close dialog"
      >
        <div class="dialog-content" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title" tabindex="-1">
          <h3 id="import-dialog-title">Importar Personaje</h3>
          <p>Pega el JSON de tu personaje de Walkscape:</p>
          <textarea 
            bind:value={importText} 
            class="import-textarea"
            placeholder="Pega aqui el JSON de tu personaje..."
          ></textarea>
          
          {#if importError}
            <div class="error-message">{importError}</div>
          {/if}
          
          <div class="dialog-buttons">
            <button class="cancel-btn" on:click={() => showImportDialog = false}>
              Cancelar
            </button>
            <button class="import-confirm-btn" on:click={importCharacter}>
              Importar
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .container {
    display: flex;
    height: 100vh;
  }

  .inventory-panel {
    width: var(--inventory-panel-width);
    background: #f5f5f5;
    border-right: 1px solid #ccc;
    overflow-y: auto;
    padding: var(--container-padding);
  }

  .inventory-panel h3 {
    margin: 0 0 var(--panel-margin-bottom) 0;
    color: var(--text-primary);
    font-size: var(--panel-title-font-size);
    font-weight: bold;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--panel-margin-bottom);
  }

  .panel-buttons {
    display: flex;
    gap: var(--button-gap);
  }

  .import-btn, .reset-btn {
    padding: var(--button-padding-small);
    border: none;
    border-radius: var(--button-border-radius);
    font-size: var(--button-font-size-small);
    cursor: pointer;
    transition: background-color var(--button-hover-duration);
  }

  .import-btn {
    background-color: var(--button-import);
    color: white;
  }

  .import-btn:hover {
    background-color: var(--button-import-hover);
  }

  .reset-btn {
    background-color: var(--button-reset);
    color: white;
  }

  .reset-btn:hover {
    background-color: var(--button-reset-hover);
  }

  .toggle-container {
    margin-bottom: var(--toggle-margin-bottom);
    padding: var(--toggle-padding);
    background: var(--toggle-container);
    border-radius: 8px;
    border: 1px solid var(--toggle-border);
  }

  .toggle-label {
    display: flex;
    align-items: center;
    cursor: pointer;
    font-size: var(--toggle-text-font-size);
    color: var(--text-primary);
  }

  .toggle-input {
    display: none;
  }

  .toggle-slider {
    position: relative;
    width: 50px;
    height: 24px;
    background: var(--toggle-background);
    border-radius: 24px;
    margin-right: 10px;
    transition: background-color var(--toggle-transition-duration);
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform var(--toggle-transition-duration);
  }

  .toggle-input:checked ~ .toggle-slider {
    background: var(--toggle-active);
  }

  .toggle-input:checked ~ .toggle-slider::before {
    transform: translateX(26px);
  }

  .toggle-text {
    user-select: none;
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

  /* Dialog styles */
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog-content {
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .dialog-content h3 {
    margin: 0 0 var(--dialog-margin-bottom) 0;
    color: var(--text-primary);
    font-size: var(--dialog-title-font-size);
    font-weight: bold;
  }

  .dialog-content p {
    margin: 0 0 var(--dialog-margin-bottom) 0;
    color: var(--text-secondary);
    font-size: var(--dialog-text-font-size);
  }

  .import-textarea {
    width: 100%;
    height: var(--textarea-height);
    padding: 12px;
    border: 2px solid #ddd;
    border-radius: 4px;
    font-family: monospace;
    font-size: var(--textarea-font-size);
    resize: vertical;
    margin-bottom: var(--dialog-margin-bottom);
  }

  .import-textarea:focus {
    outline: none;
    border-color: var(--button-import);
  }

  .error-message {
    background-color: var(--dialog-error-background);
    color: var(--dialog-error-text);
    padding: 12px;
    border-radius: 4px;
    margin-bottom: var(--dialog-margin-bottom);
    font-size: var(--error-message-font-size);
  }

  .dialog-buttons {
    display: flex;
    gap: var(--dialog-button-gap);
    justify-content: flex-end;
  }

  .cancel-btn, .import-confirm-btn {
    padding: var(--button-padding-normal);
    border: none;
    border-radius: var(--button-border-radius);
    font-size: var(--button-font-size-normal);
    cursor: pointer;
    transition: background-color var(--button-hover-duration);
  }

  .cancel-btn {
    background-color: var(--button-cancel);
    color: var(--text-secondary);
  }

  .cancel-btn:hover {
    background-color: var(--button-cancel-hover);
  }

  .import-confirm-btn {
    background-color: var(--button-import);
    color: white;
  }

  .import-confirm-btn:hover {
    background-color: var(--button-import-hover);
  }
</style>
