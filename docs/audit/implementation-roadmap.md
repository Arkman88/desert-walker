# План внедрения в существующий проект

Дата: 17.11.2026. Это план, ничего из перечисленного не реализовано аудитом. Оценки относительные: S — локальное правило; M — несколько модулей; L — домен с UI/save-интеграцией; XL — несколько зависимых доменов. Это не сроки. Планы не требуют смены камеры и генератора.

## Первые пять небольших задач

1. Зафиксировать legacy WorldIdentity и fixture совпадения height/POI/IDs; без изменения генерации.
2. Описать пять objective IDs и pure progress reducer с тестом идемпотентности, пока без UI.
3. Выделить обязательную сюжетную деревню/оазис в plan и протестировать площадку и доступ к контейнеру.
4. Подключить к reducer два успешных действия: наполнение у сюжетной воды и размещение первого собственного camp item; не засчитывать стартовый лагерь.
5. Добавить inspect существующего насоса с записью discovered/damaged, сохранив GLB, коллизию и dev-инструменты.

Это начало работ, а не обещание среза за пять задач. Дальнейшие задачи дают NPC, воду, сохранение и завершение цепочки.

## Задачи

### 1. P0: World identity и совместимая загрузка — M

- Реализовать: Добавить legacy seed/version, policy новых worlds и явную миграцию без изменения старой геометрии.
- Переиспользовать: Существующие hash/heightAt, parse/flush и SaveRecovery.
- Предполагаемые файлы (пути от src, tests/docs — от корня): terrain/worldGeneration.ts, player/playerSave.ts, survival/survivalModel.ts, survival/survivalStore.ts.
- Зависимости: Нет; первая задача.
- Риски: Смена IDs и world layout повредит старому луту.
- Готово, когда: Legacy fixtures совпадают; старый save сохраняет прогресс; повреждённый слот не перезаписывается.

### 2. P0: Минимальные objectives — M

- Реализовать: Пять целей, persistent flags/unlocks и чистый reducer; outcome только после успешного действия.
- Переиспользовать: AdventureState и модель immutable actions.
- Предполагаемые файлы (пути от src, tests/docs — от корня): новые features/progression/*; survival/survivalModel.ts, survival/survivalStore.ts.
- Зависимости: World identity для сохранения.
- Риски: Повторный E/reload или отказ команды ошибочно продвигают цель.
- Готово, когда: Порядок цепочки, идемпотентность, повторная загрузка, legacy doorOpened не теряется.

### 3. P0: Обязательные anchors и доступность — L

- Реализовать: Закрепить оазис, деревню, Тарика и станцию; ограниченные retries/fallback; проверить путь и interaction clearance.
- Переиспользовать: dryRoute, suitableGround, ruin generation и obstacles.
- Предполагаемые файлы (пути от src, tests/docs — от корня): новые features/progression/storyLocations.ts; exploration/expeditionGeneration.ts; adventure/adventureGeneration.ts; navigation/mapDiscoveries.ts.
- Зависимости: World identity.
- Риски: Локальная сухость не гарантирует полный проход игрока.
- Готово, когда: Для каждого поддержанного world plan все anchors существуют и доступны; существующие POI/loot IDs прежние.

### 4. P0: Первые игровые вехи и осмотр — M

- Реализовать: Вода → собственный лагерь → осмотр деревни/насоса; небольшой журнал с условиями без обязательных маркеров.
- Переиспользовать: E targets/occlusion, placement actions, NotesList.
- Предполагаемые файлы (пути от src, tests/docs — от корня): resources/Loot.tsx; storage/storageActions.ts; crafting/canopyActions.ts; ui/*; features/progression/*.
- Зависимости: Objectives и anchors.
- Риски: Стартовый лагерь засчитан как построенный; проверка только в UI.
- Готово, когда: Отказы не засчитываются; target/aim/range валидируются; прогресс переживает reload.

### 5. P0: Тарик и приглашение — L

- Реализовать: Один NPC, диалог, recruited state; дискретное появление в лагере с объяснённым переходом.
- Переиспользовать: Существующие interaction targets и store commands.
- Предполагаемые файлы (пути от src, tests/docs — от корня): новые features/npc/* и ui/npc/*; app/World.tsx; resources/Loot.tsx; survival/survivalModel.ts, survivalStore.ts.
- Зависимости: Anchors, objectives, persistence.
- Риски: Нет готового NPC asset, clipping и недоступная точка диалога.
- Готово, когда: Тарик находится и приглашается один раз, после reload стоит в правильном месте; пользователь проверяет внешность.

### 6. P0: Ремонт насоса и технология — L

- Реализовать: Inspect damaged station, один unlock от Тарика/чертежа, атомарный расход материалов, normal E/UI repair.
- Переиспользовать: GameObjectGroup, typed ports, station visual/physics, материал-рецепты.
- Предполагаемые файлы (пути от src, tests/docs — от корня): machines/pumpStation/*; inventory/inventory.ts; crafting/materialRecipe.ts; ui/*; features/progression/*.
- Зависимости: Тарик и objectives.
- Риски: Текущий насос уже соединён: нельзя считать соединения доказательством ремонта; dev toggle обходит условия.
- Готово, когда: Без условий ремонт отклонён без потерь; успех меняет доменное состояние; debug не выдаёт сюжетную награду.

### 7. P0: Минимальная экономика воды — L

- Реализовать: Резервуар литров/capacity, выпуск за активное время, один потребитель Тарик, наполнение фляги и objective устойчивой подачи.
- Переиспользовать: Текущие литры фляги, weather/sleep tick, storage patterns.
- Предполагаемые файлы (пути от src, tests/docs — от корня): новые features/settlement/*; machines/pumpStation/*; water/waterInteraction.ts; survival/survivalModel.ts, survivalStore.ts; rest/sleepModel.ts.
- Зависимости: Рабочий NPC и repaired station.
- Риски: Ускоренный сон, пауза, отрицательные запасы, дублирование воды.
- Готово, когда: Производство/расход ограничены, одинаковы для эквивалентного elapsed времени; sleep/pause/reload без дюпов; цепочка завершается.

### 8. P0: Сохранение и интеграционная цепочка — L

- Реализовать: Версионированно сохранять progress/NPC/settlement; проверить согласованную позу и состояние, полный flow с reload после этапов.
- Переиспользовать: module-loader, fake storage, текущие round-trip suites.
- Предполагаемые файлы (пути от src, tests/docs — от корня): survival/survivalModel.ts, survivalStore.ts; player/playerSave.ts; tests/*; ADVENTURE_TESTING.md.
- Зависимости: Все P0, контракт сохранений проектировать в начале.
- Риски: Несколько localStorage keys, quota failures, нормализация markers.
- Готово, когда: npm test/build проходят; legacy restore, corrupted save, отказ записи и повторные команды без потерь; ручной сценарий пользователю.

### 9. P1: Модульный kit и snapping — L

- Реализовать: Один набор строительных частей, spatial socket transforms/preview, поворот и world collision placement.
- Переиспользовать: Registry, atomic edits, groundPlacementAt и model pools.
- Предполагаемые файлы (пути от src, tests/docs — от корня): gameObjects/*; placement/*; новые features/building/*; ui/*.
- Зависимости: Стабильные transforms/save.
- Риски: Нельзя заменять физику validatePlacement=accepted.
- Готово, когда: Совместимые/занятые сокеты, вода/опора/игрок/перекрытия, save/reload покрыты; ручная проверка стыков.

### 10. P1: Верстак и gate рецептов — M

- Реализовать: Один верстак и proximity/unlock recipe conditions; сохранить четыре доступных camp recipes.
- Переиспользовать: Текущий crafting UI и atomic recipe spend.
- Предполагаемые файлы (пути от src, tests/docs — от корня): новые features/workstations/*; ui/crafting/*; crafting/materialRecipe.ts; resources/Loot.tsx.
- Зависимости: Unlock и placement.
- Риски: Ненужная блокировка старого крафта.
- Готово, когда: Рецепт доступен только с условиями, отказ не расходует материалы, reload сохраняет unlock.

### 11. P1: HP и правила поражения — L

- Реализовать: Определить damage, recovery/death, safe respawn; связать с условиями среды без удаления thermal model.
- Переиспользовать: BodyConditions, safe collision pose, save guards.
- Предполагаемые файлы (пути от src, tests/docs — от корня): новые features/health/*; survival/*; player/Player.tsx; ui/survival/*.
- Зависимости: Решение о тяжести survival.
- Риски: Баланс и потеря имущества; не выдавать critical severity за смерть.
- Готово, когда: Damage/death/respawn один раз, безопасная позиция, save/reload и UI проверены.

### 12. P1: NPC движение и рост поселения — L

- Реализовать: Простые маршруты безопасной зоны, назначение рабочего, небольшой stage и needs; deterministic domain ticks.
- Переиспользовать: Collision queries, stock, существующие clocks.
- Предполагаемые файлы (пути от src, tests/docs — от корня): features/npc/*; features/settlement/*; player/collision.ts; survival/survivalClock.ts.
- Зависимости: P0 экономика.
- Риски: Нет navmesh; двери/рельеф и ускоренный сон.
- Готово, когда: NPC достигает рабочего места без прохода сквозь стены; пауза/сон/частота кадров не меняют выпуск.

### 13. P1: Баланс снабжения и погоды — M

- Реализовать: Проверить материалы для лагеря/ремонта в доступном луте, определить добычу и автоматическую бурю.
- Переиспользовать: Salvage, deterministic loot, storm VFX и temperature.
- Предполагаемые файлы (пути от src, tests/docs — от корня): resources/lootGeneration.ts; inventory/materials.ts; environment/weatherModel.ts; app/gameFeatures.ts.
- Зависимости: Финальные recipes и маршрут.
- Риски: Автовключение осколков не создаёт полноценную ресурсную экономику.
- Готово, когда: Срез проходим с гарантированным минимумом supplies, варианты обхода шторма; ручная проверка длительности.

### 14. P2: Фауна, бой и угрозы — XL

- Реализовать: Один тип существа, detection/chase/disengage, копьё, block/dodge; затем оборона и угрозы поселению.
- Переиспользовать: Player/collision и health pipeline.
- Предполагаемые файлы (пути от src, tests/docs — от корня): новые features/combat/*, features/fauna/*; npc/*; inventory/*; app/World.tsx.
- Зависимости: HP, NPC navigation, settlement.
- Риски: Новые модели/анимации, hit detection, стоимость AI.
- Готово, когда: Бой и избегание дают законченные сценарии, угрозы не блокируют раннюю цепочку; профилирование на целевом устройстве.

### 15. P2: Расширенная прогрессия и оптимизация по измерениям — XL

- Реализовать: Альтернативные цели, технологии, профессии, реакции мира; profiling streaming/GLB/UI и delivery code splitting по данным.
- Переиспользовать: Существующие POI, pools, instancing и LOD.
- Предполагаемые файлы (пути от src, tests/docs — от корня): features/progression/*; features/settlement/*; placement/*; app/*; vite.config.ts при обосновании.
- Зависимости: Проверенный срез и реальные измерения.
- Риски: Scope creep и оптимизация без bottleneck.
- Готово, когда: Каждая новая ветка reload-safe; FPS/GPU budget измерены отдельно; chunk warning оценивается как delivery issue.

## Объём и контроль границ

P0 — связанная работа нескольких доменов (общая сложность XL), хотя её первые шаги можно делать небольшими M-задачами. Основной объём — NPC, progression, рабочая станция и экономика воды со сквозным сохранением; геометрию мира и survival писать заново не нужно. P1 и P2 существенно расширяют продукт и не должны задерживать мирный срез. Оценки сроков без темпа команды, требований к NPC-анимации, целевых устройств и ручной проверки баланса недостоверны.

Минимальный срез допускает одного статичного/дискретно перемещаемого NPC, один reservoir и профессию инженера, один ремонт и существующую постановку готовых camp items. Полный snap building, боёвка, навигация толпы, сеть труб и рейды для пяти целевых этапов не требуются. Перед реализацией форматов нужны отдельные миграционные решения; аудит ничего не мигрирует.
