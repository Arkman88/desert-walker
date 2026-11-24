# Повторное использование

Дата: 17.11.2026. Под «пригодно» понимается найденная интеграция и результаты автоматических проверок. Собственной визуальной проверки и замеров FPS нет; эстетика, seams, удобство и реальная стоимость GPU остаются ручной проверкой пользователя.

## Сохранить без замены

| Система | Подтверждение и ценность | Ограничение |
|---|---|---|
| Рельеф, оазисы и растительность | terrain/worldGeneration.ts, objectIndex.ts, oases/Oases.tsx; единые heightAt/shoreRadius управляют поверхностью, берегом и растительностью | Генерация фиксированного мира, не произвольных user seeds |
| Terrain streaming | TerrainStream.ts, terrainPlan.ts, terrain.worker.ts; очереди, LOD hysteresis, worker transfers, bounded installs и dispose | Не даёт измеренного FPS всего проекта |
| Первое лицо и физика | player/Player.tsx, collision.ts, water/water.ts; бег, прыжок, вода, двери/крыши/опоры | Нет combat/AI body pipeline |
| Inventory/storage/salvage | inventory/*, storage/*, resources/lootContainer.ts; масса, слоты, стаки, отказ без потерь, stable IDs | Это запасы игрока/контейнеров, не settlement economy |
| Camp crafting/placement | canopyActions, fireActions, bedActions, storageActions и groundPlacementAt; ресурс → kit → размещение | Нет editor модульных зданий |
| Температура/выживание | thermalExposure, bodyTemperature, bodyConditions, stamina, sleepModel; солнце/ветер/тень/одежда/вода/огонь и сон | Severity здоровья не HP; clock не глобальный fixed simulation |
| Исследование | expeditionGeneration/Notes, roadModel, mapDiscoveries, MapSurvey и карта | Discovery не quest completion |
| Скважина | adventureGeneration/adventureActions, doorOpened, useful flask reward; сквозные тесты flow/reload | Сохранить как отдельное приключение, не переименовывать в ремонт насоса |
| GameObject core | registry/catalog/operations/validation/transform; независимые definitions и policies, атомарные edits | Наличие durability/snap не создаёт игровой repair/snap |
| GPU ownership | modelAssetPool, shared/three/modelResources, model batching/instances | Каждый новый adapter обязан явно владеть ресурсами |
| Save protection | parseSurvivalSave/flush, SaveRecovery, резервирование несовместимых bytes и запрет перезаписи | Новые поля требуют явной совместимости и проверки раздельных слотов |

## Расширять локально

- `resources/Loot.tsx`: новые inspect/NPC/station targets поверх существующих aim/range/occlusion, сохраняя E для дверей, воды, лута и отдыха. Общий target dispatcher выделять только по росту этой логики.
- `gameObjects`: добавить определения новых составных зданий/машин и доменные policies; сохранять данные отдельно от Three.js и stable transforms/IDs.
- `machines/pumpStation`: использовать корпус, насос, бак, трубу, питание, typed ports и визуализацию; добавить repaired/operating, литры и рабочее место отдельно от видимости соединений.
- `crafting/materialRecipe.ts` и CraftingPanel: новые recipe conditions/unlocks без замены четырёх готовых рецептов и атомарного расхода.
- `navigation` и текстовые notes: назначить существующим POI сюжетные роли, сохранить discovery по прибытии. Не включать глобальные маркеры как условие прогресса.
- `survivalStore`: оставить facade, кэши obstacles/sites и подписки; новую бизнес-логику поместить в feature actions/reducers. UI не должен решать, состоялся ли repair/recruit.
- `tests`: использовать module-loader, fake storage/workers, GLB-тесты и существующие round-trip сценарии для NPC, quest и water economy.

## Требует целевой переработки, а не замены проекта

1. World identity: вынести legacy seed/version в явный контракт, проверяя совпадение старого мира. Seed внутри отдельного ruin layout не равен seed всего мира.
2. Progression: одного adventure.doorOpened недостаточно; добавить независимые flags/objectives/unlocks, не уничтожая старое приключение.
3. Persistence новых доменов: обсудить migration и revision отдельных player/survival keys; сохранить write-lock/export/backup. Существующий формат в аудите не менялся.
4. Spatial sockets: снабдить сокеты позицией/ориентацией и алгоритмом поиска для snap preview; существующая проверка совместимости портов остаётся.
5. Simulation: новый production/NPC tick должен учитывать паузу и ускоренный сон. Не переносить анимацию пальм/пыли на доменный clock без необходимости.

## Ассеты: что есть и что подключено

| Набор | Использование сейчас | Как переиспользовать |
|---|---|---|
| public/assets/desert_hut_v4/desert_hut_v4.glb | Активная хижина testHut (12, −15), yaw π; дверь/ящик/коллизии/материалы связаны с логическими частями | Оставить модель и mapping hutParts/hutRenderAdapter; три procedural houses собираются из деталей V4 через houseAssets |
| public/textures/desert_hut/* | PBR basecolor/normal/roughness для adobe, burlap, logs, planks, rust через hutMaterials | Сохранить цветовые пространства, UV масштаб и shared material leases |
| public/assets/desert_village_ruins_6_variants/* | Шесть GLB: archway, collapsed_house, corner_ruin, courtyard, market_stall, tower; активны в RuinVillages | Использовать layouts, footprint/proxy/UV preparation и V4 материалы. Тестовый результат batching 402 meshes → 22 batches относится к набору, не к FPS |
| public/assets/desert_craft_models/{bed,campfire,portable_canopy}.glb | Активные craft models/preview через craftModelAssets и ModelInstances | Сохранить соответствие размеров размещения, тепла/тени и render placement |
| public/assets/crate/desert_crate_v4.glb | crateAsset и текущие ящики | Сохранить bounds, материалы, контейнерные IDs и persistent dismantling |
| pumpStationVisual.ts | Активная процедурная геометрия станции, отдельные pipe/power parts | Использовать как базу рабочего механизма; не требуется новый GLB ради первой экономики воды |
| public/assets/desert_hut_asset, desert_hut_v2, desert_hut_v3_seamless, desert_hut_3_variants | Файлы существуют, но не являются основным активным V4 runtime по текущему testHut layout | Сохранить как библиотеку; перед новым подключением проверить mapping/bounds/materials, не объявлять готовыми игровыми домами только по файлу |
| temp/desert_hut* | Исходные варианты/текстуры и README | Сохранить, не дублировать автоматически в public и не удалять |
| NPC/оружие/существа | Подключённые модели NPC, Тарика, копья или животных не обнаружены | Включить подбор/создание assets в будущий scope; не выдавать геометрическую заглушку за готового NPC |

Нельзя обещать, что все запасные assets подходят без доработок: активные adapters поддерживают конкретные соглашения имён, UV и bounds. Сохранять имеющиеся models/textures и результаты подготовки выгоднее, чем менять визуальную библиотеку ради новой логической архитектуры.
