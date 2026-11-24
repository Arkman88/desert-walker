# Аудит механик «Последнего оазиса»

Дата: 17.11.2026. Анализ локального snapshot; Git-метаданные отсутствуют (`git status` возвращает «not a git repository»), поэтому commit SHA не установлен. Игровой код, зависимости, ассеты и формат сохранений не изменялись. По более узкому ограничению задания создаются только четыре документа: PROGRESS.md не обновлялся.

## Метод и границы достоверности

Проверены состав src, public, tests, scripts, конфигурация и архитектурные документы; выводы основаны на цепочках App → World → feature → store/action → state/save, а не на планах в Markdown. Старые проектные описания не считаются доказательством подключения. Основные поисковые границы для отсутствующих систем: все src, определения Item/SurvivalState/Components, регистрации каталога, состав World, UI и store actions. Для MISSING указанные файлы показывают границы действующего runtime, а не реализацию отсутствующей механики.

IMPLEMENTED означает найденную игровую интеграцию и подтверждение статическим анализом/релевантными тестами; это не сертификат визуальной работоспособности. PARTIAL — есть действующая часть; STUB — есть контракт или демонстрационный каркас без целевого процесса; DIFFERENT — действующий процесс отличается от цели. UNKNOWN предназначен для механик, наличие которых нельзя установить; здесь все строки классифицированы по коду, а визуальная корректность и FPS остаются непроверенными отдельно. P0 — блокирует целевую пятишаговую цепочку; P1 — важное расширение; P2 — развитие/сохранение готового решения, не предписание его переделывать.

Сбор осколков **временно скрыт** (`GAME_FEATURES.resourceCollection=false`), но Loot, salvage ящиков/одежды/записок и крафт **активны**. Снятие уличных навесов отражено в `removeStreetShelters`; это удалённые элементы старой композиции, а не отсутствие переносного навеса. Насос **видим**, соединения доступны только в DEV-меню; поставка воды **не реализована**. Обозначения здоровья в HUD не доказывают наличие HP.

## Проверки

- `npm test` — PASS, exit 0: все 18 entrypoints из package.json. Проверяются генерация, streaming, survival, inventory, размещение, лут, сохранения, приключение, GLB, группы, насос и руины. Это Node/domain/asset tests, а не браузерный прогон.
- `npm run build` — PASS, exit 0; включает TypeScript `tsc -b` и Vite. Отдельного typecheck-скрипта нет, проверка типов выполнена первой стадией build.
- Lint — скрипт и конфигурация линтера не обнаружены; не запускался, зависимости не устанавливались.
- Существующая диагностика: Vite предупреждает о chunk >500 kB; основной JS 1433.96 kB, gzip 413.32 kB. Это размер доставки, не измерение FPS. Ошибок тестов/типизации/сборки не обнаружено.
- Браузер, скриншоты, собственная визуальная проверка, FPS и GPU profiling не выполнялись согласно AGENTS.md. Browser restart/Pointer Lock/WebGL и удобство интерфейса требуют ручной проверки пользователя. Сборка создала обычные dist/tsbuildinfo артефакты.

## Матрица покрытия

Одна строка соответствует одному пункту A–J исходного перечня; составные пункты не разбивались для увеличения покрытия. Поэтому, например, четыре готовых camp items и отсутствующий верстак дают PARTIAL всей строке.

| Система | IMPLEMENTED | PARTIAL | STUB | MISSING | DIFFERENT | UNKNOWN | Всего |
|---|---:|---:|---:|---:|---:|---:|---:|
| A Мир | 3 | 5 | 0 | 0 | 0 | 0 | 8 |
| B Персонаж | 3 | 2 | 0 | 2 | 0 | 0 | 7 |
| C Строительство | 3 | 6 | 1 | 0 | 0 | 0 | 10 |
| D Инвентарь и крафт | 3 | 2 | 0 | 2 | 0 | 0 | 7 |
| E Исследование | 4 | 2 | 1 | 0 | 0 | 0 | 7 |
| F NPC и поселение | 0 | 0 | 0 | 10 | 0 | 0 | 10 |
| G Сюжет | 0 | 3 | 0 | 3 | 1 | 0 | 7 |
| H Опасности | 1 | 1 | 0 | 7 | 0 | 0 | 9 |
| I Сохранения | 2 | 3 | 0 | 2 | 0 | 0 | 7 |
| J Архитектура | 3 | 4 | 0 | 0 | 0 | 0 | 7 |
| Всего | 22 | 28 | 2 | 26 | 1 | 0 | 79 |

## Сравнение

| Система | Механика | Текущее состояние | Целевое состояние | Статус | Приоритет |
|---|---|---|---|---|---|
| A Мир | Генерация по seed | Повторяемые координатные hash/noise; seed мира зашит константами | Полная механика: генерация по seed | PARTIAL | P0 |
| A Мир | Генерация и выгрузка чанков | Два worker, очереди, удаление mesh, ограниченный cache | Полная механика: генерация и выгрузка чанков | IMPLEMENTED | P2 |
| A Мир | Рельеф и ресурсные зоны | Дюны, камни, оазисы, растительность; сбор осколков временно скрыт | Полная механика: рельеф и ресурсные зоны | PARTIAL | P1 |
| A Мир | Процедурное размещение POI | Дома, деревни, дороги, руины с отбраковкой площадок | Полная механика: процедурное размещение poi | IMPLEMENTED | P2 |
| A Мир | Гарантия сюжетных локаций | Скважина привязана к fixed chunk; генератор вправе вернуть null; Тарика нет | Полная механика: гарантия сюжетных локаций | PARTIAL | P0 |
| A Мир | Доступность сюжетных объектов | dryRoute проверяет сухость и перепад, руины проверяют проходы; глобальной проверки нет | Полная механика: доступность сюжетных объектов | PARTIAL | P0 |
| A Мир | Изменения процедурного мира | История лута, разборки, содержимое и overrides групп сохраняются; общий delta-контракт не выделен | Полная механика: изменения процедурного мира | PARTIAL | P0 |
| A Мир | Вариации руин и поселений через группы | Три layout руин, seed вариаций, повороты, шесть моделей; дома также имеют groups | Полная механика: вариации руин и поселений через группы | IMPLEMENTED | P2 |
| B Персонаж | Передвижение и камера | Первое лицо, pointer lock, собственная collision-физика, вода | Полная механика: передвижение и камера | IMPLEMENTED | P2 |
| B Персонаж | Бег, прыжок, взаимодействие | Shift, Space с расходом сил, E с aim/range/occlusion | Полная механика: бег, прыжок, взаимодействие | IMPLEMENTED | P2 |
| B Персонаж | Здоровье и выносливость | Stamina и болезни активны; HealthIndicator отображает severity, числовых HP нет | Полная механика: здоровье и выносливость | PARTIAL | P1 |
| B Персонаж | Жажда и расход воды | Литры фляг, вода в пакетах, жара/бег, наполнение у берега | Полная механика: жажда и расход воды | IMPLEMENTED | P2 |
| B Персонаж | Получение урона | Есть ухудшение состояния, нет applyDamage или HP-потерь | Полная механика: получение урона | MISSING | P1 |
| B Персонаж | Смерть и возрождение | Нет death state, defeat flow или respawn | Полная механика: смерть и возрождение | MISSING | P1 |
| B Персонаж | Инструменты и оружие | Монтировка открывает дверь при наличии; оружия и активного использования инструмента нет | Полная механика: инструменты и оружие | PARTIAL | P1 |
| C Строительство | Свободное размещение | Навес, ящик, костёр, кровать на сетке 0.25 м; нет свободного поворота зданий | Полная механика: свободное размещение | PARTIAL | P1 |
| C Строительство | Модульное строительство | API add/remove/replace деталей работает; пользователь строит готовые kits | Полная механика: модульное строительство | PARTIAL | P1 |
| C Строительство | Snap points | Тип snap и socket validation существуют; пространственного поиска и привязки нет | Полная механика: snap points | STUB | P1 |
| C Строительство | Допустимость размещения | Проверки воды, опоры, уклона, игрока и AABB; повторная проверка действия | Полная механика: допустимость размещения | IMPLEMENTED | P2 |
| C Строительство | Расход ресурсов на строительство | Рецепт расходует материалы на kit; установка расходует kit атомарно | Полная механика: расход ресурсов на строительство | IMPLEMENTED | P2 |
| C Строительство | Костёр, кровать, навес, склад, верстак | Первые четыре активны; склад представлен ящиком; верстака нет | Полная механика: костёр, кровать, навес, склад, верстак | PARTIAL | P0 |
| C Строительство | Группировка объектов | Хижина, дома, руины и машина — группы; placed camp items в отдельных массивах | Полная механика: группировка объектов | PARTIAL | P1 |
| C Строительство | Правила композиции и соединения групп | Registry policies и typed sockets; machine placement всегда accepted; межгрупповых связей нет | Полная механика: правила композиции и соединения групп | PARTIAL | P1 |
| C Строительство | Сохранение построек | Группы и placed camps/storage/fires/beds сериализуются | Полная механика: сохранение построек | IMPLEMENTED | P2 |
| C Строительство | Здания и рабочие места | Тень, сон, тепло, хранение действуют; профессий и производства нет | Полная механика: здания и рабочие места | PARTIAL | P0 |
| D Инвентарь и крафт | Слоты и стаки | Группировка, лимиты слотов, веса, stack merge | Полная механика: слоты и стаки | IMPLEMENTED | P2 |
| D Инвентарь и крафт | Подбор и хранение ресурсов | Лут и salvage доступны; отдельные осколки выключены и не основа crafting | Полная механика: подбор и хранение ресурсов | PARTIAL | P1 |
| D Инвентарь и крафт | Расходование ресурсов | Вода, еда, топливо и crafting расходуются с проверками | Полная механика: расходование ресурсов | IMPLEMENTED | P2 |
| D Инвентарь и крафт | Рецепты крафта | Четыре готовых рецепта в UI | Полная механика: рецепты крафта | IMPLEMENTED | P2 |
| D Инвентарь и крафт | Инструменты и снаряжение | Рюкзак, шляпа, тёплая одежда активны; инструмент ограничен монтировкой | Полная механика: инструменты и снаряжение | PARTIAL | P1 |
| D Инвентарь и крафт | Крафт на рабочих местах | Все рецепты доступны из C; station gate отсутствует | Полная механика: крафт на рабочих местах | MISSING | P1 |
| D Инвентарь и крафт | Открытие рецептов исследованиями/NPC | У рецептов нет unlock state, записки не открывают технологии | Полная механика: открытие рецептов исследованиями/npc | MISSING | P0 |
| E Исследование | Руины, деревни и POI | Подключены Locations, RuinVillages, ExplorationSites и BoreholeSites | Полная механика: руины, деревни и poi | IMPLEMENTED | P2 |
| E Исследование | Контейнеры с находками | Генерируемые и встроенные ящики, take/deposit, разборка, depletion | Полная механика: контейнеры с находками | IMPLEMENTED | P2 |
| E Исследование | Исследуемые объекты | Контейнеры, дверь с tool gate и читаемые записки; общего examine нет | Полная механика: исследуемые объекты | PARTIAL | P0 |
| E Исследование | Сюжетные записки и чертежи | Направляющие записки и журнал скважины; чертежи/unlock отсутствуют | Полная механика: сюжетные записки и чертежи | PARTIAL | P0 |
| E Исследование | Обнаружение без обязательных маркеров | Discovery по близости, текстовые направления, карта требует предмет | Полная механика: обнаружение без обязательных маркеров | IMPLEMENTED | P2 |
| E Исследование | Экспедиции с подготовкой и рисками | Дистанции, запас воды/еды, вес, температура и ночной холод дают риск | Полная механика: экспедиции с подготовкой и рисками | IMPLEMENTED | P1 |
| E Исследование | Восстановление древних механизмов | Насос видим, соединения переключаются dev-кнопками; производства и ремонта нет | Полная механика: восстановление древних механизмов | STUB | P0 |
| F NPC и поселение | NPC: состояния и поведение | В World и SurvivalState нет акторов NPC | Полная механика: npc: состояния и поведение | MISSING | P0 |
| F NPC и поселение | Навигация NPC | Есть collision игрока и dryRoute, нет NPC movement/pathfinding | Полная механика: навигация npc | MISSING | P1 |
| F NPC и поселение | Приглашение жителей | Нет recruit action/state | Полная механика: приглашение жителей | MISSING | P0 |
| F NPC и поселение | Потребности жителей | Потребности только у игрока | Полная механика: потребности жителей | MISSING | P1 |
| F NPC и поселение | Профессии и рабочие места | Нет назначений работников | Полная механика: профессии и рабочие места | MISSING | P0 |
| F NPC и поселение | Автоматизация производства | Есть burn топлива, но нет выпуска продукции | Полная механика: автоматизация производства | MISSING | P1 |
| F NPC и поселение | Запасы поселения | Ящики игрока не являются общим settlement stock | Полная механика: запасы поселения | MISSING | P0 |
| F NPC и поселение | Водоснабжение и потребление | Порты насоса не переносят воду | Полная механика: водоснабжение и потребление | MISSING | P0 |
| F NPC и поселение | Развитие поселения | Наличие построек не образует settlement stage | Полная механика: развитие поселения | MISSING | P1 |
| F NPC и поселение | Реакция мира на базу | Нет реакции на развитие лагеря | Полная механика: реакция мира на базу | MISSING | P2 |
| G Сюжет | Система заданий | Нет quest definitions, objectives, journal; adventure лишь doorOpened | Полная механика: система заданий | MISSING | P0 |
| G Сюжет | Сюжетные флаги и условия | doorOpened и наличие crowbar действуют и сохраняются | Полная механика: сюжетные флаги и условия | PARTIAL | P0 |
| G Сюжет | Цепочки заданий | Работает journal → well → crowbar → door → flask → village без quest engine | Полная механика: цепочки заданий | DIFFERENT | P0 |
| G Сюжет | Сюжетные вехи | Открытая дверь и награда меняют доступ; milestones среза не заданы | Полная механика: сюжетные вехи | PARTIAL | P0 |
| G Сюжет | Альтернативные способы целей | Для двери один tool gate; общих альтернативных objective conditions нет | Полная механика: альтернативные способы целей | MISSING | P2 |
| G Сюжет | Технологии через находки | Note — текст, state исследований отсутствует | Полная механика: технологии через находки | MISSING | P0 |
| G Сюжет | Изменения мира после заданий | Дверь меняет коллизию; целевых сюжетных преобразований нет | Полная механика: изменения мира после заданий | PARTIAL | P0 |
| H Опасности | Погода и песчаные бури | Буря активируется переключателем, конечный таймер; автоматического расписания нет | Полная механика: погода и песчаные бури | PARTIAL | P1 |
| H Опасности | Жара и среда | Солнце, тень, ветер, одежда, вода, костёр и температура тела | Полная механика: жара и среда | IMPLEMENTED | P2 |
| H Опасности | Дикие существа | Tumbleweeds — декор, не существа | Полная механика: дикие существа | MISSING | P2 |
| H Опасности | Обнаружение и преследование врагами | Нет enemy actors/sensors | Полная механика: обнаружение и преследование врагами | MISSING | P2 |
| H Опасности | Ближний бой копьём | Нет spear item или melee action | Полная механика: ближний бой копьём | MISSING | P2 |
| H Опасности | Урон, блок и уклонение | Прыжок не является dodge, collision не является combat | Полная механика: урон, блок и уклонение | MISSING | P2 |
| H Опасности | Избегание столкновений | Врагов нет; обход среды не подтверждает stealth/disengage | Полная механика: избегание столкновений | MISSING | P2 |
| H Опасности | Оборонительные постройки | Стены имеют коллизию; оборонительная функция отсутствует | Полная механика: оборонительные постройки | MISSING | P2 |
| H Опасности | Угрозы поселению | Нет поселения и системы атак | Полная механика: угрозы поселению | MISSING | P2 |
| I Сохранения | Сохранение seed и версии генератора | Версия survival 19 и pose 1 — версии схем, не генератора | Полная механика: сохранение seed и версии генератора | MISSING | P0 |
| I Сохранения | Состояние персонажа | Pose отдельно; needs/inventory/clothing/stamina/temperature в survival | Полная механика: состояние персонажа | IMPLEMENTED | P2 |
| I Сохранения | Постройки | Placed items и GameObjectWorld сохраняются | Полная механика: постройки | IMPLEMENTED | P2 |
| I Сохранения | Изменения мира | Лут, dismantled IDs, contents, door и group overrides; не произвольный world delta | Полная механика: изменения мира | PARTIAL | P0 |
| I Сохранения | NPC и поселение | Нет соответствующих полей save | Полная механика: npc и поселение | MISSING | P0 |
| I Сохранения | Прогресс заданий | Сохраняется doorOpened; нет целевых objectives/unlocks | Полная механика: прогресс заданий | PARTIAL | P0 |
| I Сохранения | Восстановление после перезапуска | Round-trip и reload тесты проходят; pose/survival раздельны, browser restart не проверялся | Полная механика: восстановление после перезапуска | PARTIAL | P0 |
| J Архитектура | Логика отдельно от рендера | GameObject core сериализуемый; generation использует Three MathUtils, player physics в TSX | Полная механика: логика отдельно от рендера | PARTIAL | P1 |
| J Архитектура | Независимые системы | Feature-каталоги есть; survivalStore координирует много доменов | Полная механика: независимые системы | PARTIAL | P1 |
| J Архитектура | Событийная модель | subscribe/publish уведомляют UI; типизированных gameplay events нет | Полная механика: событийная модель | PARTIAL | P0 |
| J Архитектура | Детерминированное обновление | Clock накапливает >=0.25s и отдаёт весь интервал; player variable delta; exposure использует render time | Полная механика: детерминированное обновление | PARTIAL | P1 |
| J Архитектура | Оптимизация рендеринга | Batching, ограниченные очереди, кеши, throttle UI/interaction | Полная механика: оптимизация рендеринга | IMPLEMENTED | P2 |
| J Архитектура | Instancing, LOD и ресурсы | Terrain 48/16/8, material batching, resource leases, dispose | Полная механика: instancing, lod и ресурсы | IMPLEMENTED | P2 |
| J Архитектура | Автоматические тесты | 18 последовательно выполняемых test entrypoints, Node loader и проверки реальных GLB | Полная механика: автоматические тесты | IMPLEMENTED | P0 |

## Доказательства, пробелы и необходимые изменения

Пути ниже относительно `src/features/`, кроме `shared/…` (от `src/`) и явно указанных переходов. Что работает или присутствует — в поле «Факт»; недостающая часть и зависимости — в поле «Далее». IMPLEMENTED не требует обязательной доработки. Для MISSING факт — результат проверки отсутствия, а не заглушка.

### 1. A: Генерация по seed — PARTIAL

Факт: Повторяемые координатные hash/noise; seed мира зашит константами.

Основание: `terrain/worldGeneration.ts: hash, heightAt`.

Далее: Добавить WorldIdentity с legacy seed и версией; зависит от сохранений.

### 2. A: Генерация и выгрузка чанков — IMPLEMENTED

Факт: Два worker, очереди, удаление mesh, ограниченный cache.

Основание: `terrain/TerrainStream.ts: setCenter, tick, dispose`.

Далее: Сохранить; новые POI подключать к существующему streaming.

### 3. A: Рельеф и ресурсные зоны — PARTIAL

Факт: Дюны, камни, оазисы, растительность; сбор осколков временно скрыт.

Основание: `terrain/worldGeneration.ts; ../app/gameFeatures.ts: resourceCollection=false`.

Далее: Нужны ресурсные зоны для экономики; зависит от рецептов.

### 4. A: Процедурное размещение POI — IMPLEMENTED

Факт: Дома, деревни, дороги, руины с отбраковкой площадок.

Основание: `locations/locationGeneration.ts; exploration/expeditionGeneration.ts; locations/ruins/ruinGeneration.ts`.

Далее: Сохранить генераторы и ID; расширять контент.

### 5. A: Гарантия сюжетных локаций — PARTIAL

Факт: Скважина привязана к fixed chunk; генератор вправе вернуть null; Тарика нет.

Основание: `adventure/adventureGeneration.ts: generateBoreholeAdventure`.

Далее: Добавить обязательные anchors и fallback; зависит от WorldIdentity.

### 6. A: Доступность сюжетных объектов — PARTIAL

Факт: dryRoute проверяет сухость и перепад, руины проверяют проходы; глобальной проверки нет.

Основание: `adventure/adventureGeneration.ts: dryRoute; locations/ruins/ruinGeneration.ts`.

Далее: Проверить маршрут всей цепочки и точки взаимодействия; зависит от anchors и collision.

### 7. A: Изменения процедурного мира — PARTIAL

Факт: История лута, разборки, содержимое и overrides групп сохраняются; общий delta-контракт не выделен.

Основание: `survival/survivalModel.ts: parseSurvivalSave; storage/storageActions.ts`.

Далее: Расширить sparse overrides под сюжет; зависит от стабильных ID.

### 8. A: Вариации руин и поселений через группы — IMPLEMENTED

Факт: Три layout руин, seed вариаций, повороты, шесть моделей; дома также имеют groups.

Основание: `locations/ruins/ruinGeneration.ts: generateRuinVillage; locations/proceduralHouses/houseDefinitions.ts`.

Далее: Сохранить; жилое поселение с NPC добавляется отдельно.

### 9. B: Передвижение и камера — IMPLEMENTED

Факт: Первое лицо, pointer lock, собственная collision-физика, вода.

Основание: `player/Player.tsx: Player; player/collision.ts`.

Далее: Сохранить перспективу и физику.

### 10. B: Бег, прыжок, взаимодействие — IMPLEMENTED

Факт: Shift, Space с расходом сил, E с aim/range/occlusion.

Основание: `player/Player.tsx; resources/Loot.tsx: Loot`.

Далее: Расширять типы целей, сохранить проверки доступа.

### 11. B: Здоровье и выносливость — PARTIAL

Факт: Stamina и болезни активны; HealthIndicator отображает severity, числовых HP нет.

Основание: `survival/stamina.ts; survival/bodyConditions.ts; ../../ui/survival/HealthIndicator.tsx`.

Далее: Для боя нужен health/damage контракт; зависит от правил поражения.

### 12. B: Жажда и расход воды — IMPLEMENTED

Факт: Литры фляг, вода в пакетах, жара/бег, наполнение у берега.

Основание: `survival/survivalModel.ts: drink, refillFlasks, advanceSurvival; water/waterInteraction.ts`.

Далее: Сохранить; подключить резервуар станции.

### 13. B: Получение урона — MISSING

Факт: Есть ухудшение состояния, нет applyDamage или HP-потерь.

Основание: `survival/survivalModel.ts: SurvivalState; player/Player.tsx`.

Далее: Добавить доменный damage и источники; зависит от HP.

### 14. B: Смерть и возрождение — MISSING

Факт: Нет death state, defeat flow или respawn.

Основание: `survival/survivalModel.ts; ../app/App.tsx`.

Далее: Определить последствия и safe spawn; зависит от HP и saves.

### 15. B: Инструменты и оружие — PARTIAL

Факт: Монтировка открывает дверь при наличии; оружия и активного использования инструмента нет.

Основание: `adventure/adventureActions.ts: openTechnicalDoor; inventory/inventory.ts`.

Далее: Сохранить tool gate; добавить действия только при вводе соответствующих механик.

### 16. C: Свободное размещение — PARTIAL

Факт: Навес, ящик, костёр, кровать на сетке 0.25 м; нет свободного поворота зданий.

Основание: `placement/PlacementPreview.tsx; placement/groundPlacement.ts: groundPlacementAt`.

Далее: Расширить transform и выбор orientation; зависит от collision.

### 17. C: Модульное строительство — PARTIAL

Факт: API add/remove/replace деталей работает; пользователь строит готовые kits.

Основание: `gameObjects/gameObjectOperations.ts; placement/placeableItems.ts`.

Далее: Добавить небольшой building kit и игровой UI; зависит от assembly rules.

### 18. C: Snap points — STUB

Факт: Тип snap и socket validation существуют; пространственного поиска и привязки нет.

Основание: `gameObjects/gameObjectModel.ts: GroupConnection, GameObjectDefinition`.

Далее: Нужны socket transforms, выбор кандидата и preview; зависит от модульного kit.

### 19. C: Допустимость размещения — IMPLEMENTED

Факт: Проверки воды, опоры, уклона, игрока и AABB; повторная проверка действия.

Основание: `placement/groundPlacement.ts; camps/canopyPlacement.ts; placement/worldObstacles.ts`.

Далее: Сохранить; расширять для новых footprint.

### 20. C: Расход ресурсов на строительство — IMPLEMENTED

Факт: Рецепт расходует материалы на kit; установка расходует kit атомарно.

Основание: `crafting/materialRecipe.ts; crafting/canopyActions.ts; storage/storageActions.ts`.

Далее: Сохранить схему kit → placement.

### 21. C: Костёр, кровать, навес, склад, верстак — PARTIAL

Факт: Первые четыре активны; склад представлен ящиком; верстака нет.

Основание: `fire/fireActions.ts; rest/bedActions.ts; crafting/canopyActions.ts; storage/storageActions.ts`.

Далее: Добавить верстак лишь для station recipe; зависит от crafting.

### 22. C: Группировка объектов — PARTIAL

Факт: Хижина, дома, руины и машина — группы; placed camp items в отдельных массивах.

Основание: `gameObjects/gameObjectModel.ts; survival/survivalModel.ts: SurvivalState`.

Далее: Сохранять смешанную модель; adapter для новых составных зданий.

### 23. C: Правила композиции и соединения групп — PARTIAL

Факт: Registry policies и typed sockets; machine placement всегда accepted; межгрупповых связей нет.

Основание: `gameObjects/gameObjectOperations.ts: validateGroup; machines/pumpStation/pumpStationDefinition.ts: registerPumpStation`.

Далее: Для игрока добавить world placement rules; межгрупповые сети отложить.

### 24. C: Сохранение построек — IMPLEMENTED

Факт: Группы и placed camps/storage/fires/beds сериализуются.

Основание: `survival/survivalModel.ts: parseSurvivalSave; survival/survivalStore.ts: flush`.

Далее: Сохранить с защитой старых слотов.

### 25. C: Здания и рабочие места — PARTIAL

Факт: Тень, сон, тепло, хранение действуют; профессий и производства нет.

Основание: `environment/thermalExposure.ts; rest/sleepModel.ts; storage/storageActions.ts`.

Далее: Добавить одно рабочее место инженера; зависит от NPC и station.

### 26. D: Слоты и стаки — IMPLEMENTED

Факт: Группировка, лимиты слотов, веса, stack merge.

Основание: `inventory/inventory.ts: addToInventory; inventory/inventoryGroups.ts`.

Далее: Сохранить; новые предметы через текущий union/валидацию.

### 27. D: Подбор и хранение ресурсов — PARTIAL

Факт: Лут и salvage доступны; отдельные осколки выключены и не основа crafting.

Основание: `resources/Loot.tsx; inventory/inventoryActions.ts; ../app/gameFeatures.ts`.

Далее: Связать добычу с экономикой только после оценки снабжения.

### 28. D: Расходование ресурсов — IMPLEMENTED

Факт: Вода, еда, топливо и crafting расходуются с проверками.

Основание: `survival/survivalModel.ts; crafting/materialRecipe.ts; fire/fireActions.ts`.

Далее: Сохранить атомарные отказы.

### 29. D: Рецепты крафта — IMPLEMENTED

Факт: Четыре готовых рецепта в UI.

Основание: `../../ui/crafting/CraftingPanel.tsx: RECIPES`.

Далее: Расширить каталог при новых рецептах.

### 30. D: Инструменты и снаряжение — PARTIAL

Факт: Рюкзак, шляпа, тёплая одежда активны; инструмент ограничен монтировкой.

Основание: `inventory/clothing.ts; inventory/inventoryActions.ts; adventure/adventureActions.ts`.

Далее: Расширять без замены инвентаря.

### 31. D: Крафт на рабочих местах — MISSING

Факт: Все рецепты доступны из C; station gate отсутствует.

Основание: `../../ui/crafting/CraftingPanel.tsx; survival/survivalStore.ts`.

Далее: Добавить proximity/workstation condition; зависит от верстака.

### 32. D: Открытие рецептов исследованиями/NPC — MISSING

Факт: У рецептов нет unlock state, записки не открывают технологии.

Основание: `../../ui/crafting/CraftingPanel.tsx; exploration/noteModel.ts`.

Далее: Добавить unlock для ремонта насоса; зависит от progression.

### 33. E: Руины, деревни и POI — IMPLEMENTED

Факт: Подключены Locations, RuinVillages, ExplorationSites и BoreholeSites.

Основание: `../app/World.tsx: World`.

Далее: Сохранить всё содержимое; назначить одну деревню сюжетной.

### 34. E: Контейнеры с находками — IMPLEMENTED

Факт: Генерируемые и встроенные ящики, take/deposit, разборка, depletion.

Основание: `storage/storageContainers.ts; storage/storageActions.ts; resources/Loot.tsx`.

Далее: Сохранить ID и содержимое.

### 35. E: Исследуемые объекты — PARTIAL

Факт: Контейнеры, дверь с tool gate и читаемые записки; общего examine нет.

Основание: `resources/Loot.tsx; adventure/adventureActions.ts`.

Далее: Добавить inspect для насоса и сюжетных целей.

### 36. E: Сюжетные записки и чертежи — PARTIAL

Факт: Направляющие записки и журнал скважины; чертежи/unlock отсутствуют.

Основание: `exploration/expeditionNotes.ts; adventure/adventureGeneration.ts`.

Далее: Добавить один чертёж с постоянным unlock.

### 37. E: Обнаружение без обязательных маркеров — IMPLEMENTED

Факт: Discovery по близости, текстовые направления, карта требует предмет.

Основание: `navigation/mapDiscoveries.ts; navigation/MapSurvey.tsx; ../app/App.tsx: openMap`.

Далее: Сохранить обнаружение по прибытии.

### 38. E: Экспедиции с подготовкой и рисками — IMPLEMENTED

Факт: Дистанции, запас воды/еды, вес, температура и ночной холод дают риск.

Основание: `exploration/expeditionGeneration.ts; survival/survivalModel.ts; survival/stamina.ts`.

Далее: Настроить длительность сюжетных маршрутов; баланс без замеров неизвестен.

### 39. E: Восстановление древних механизмов — STUB

Факт: Насос видим, соединения переключаются dev-кнопками; производства и ремонта нет.

Основание: `machines/pumpStation/PumpStationDebug.tsx; machines/pumpStation/pumpStationDefinition.ts`.

Далее: Добавить normal interaction, ремонт, water output; зависит от материалов и прогрессии.

### 40. F: NPC: состояния и поведение — MISSING

Факт: В World и SurvivalState нет акторов NPC.

Основание: `../app/World.tsx; survival/survivalModel.ts`.

Далее: Один Тарик с idle/dialogue/recruited; зависит от anchors.

### 41. F: Навигация NPC — MISSING

Факт: Есть collision игрока и dryRoute, нет NPC movement/pathfinding.

Основание: `player/collision.ts; adventure/adventureGeneration.ts`.

Далее: Для среза дискретный переход в лагерь; полноценные пути позже.

### 42. F: Приглашение жителей — MISSING

Факт: Нет recruit action/state.

Основание: `survival/survivalStore.ts; resources/Loot.tsx`.

Далее: Добавить идемпотентное приглашение Тарика; зависит от NPC и progression.

### 43. F: Потребности жителей — MISSING

Факт: Потребности только у игрока.

Основание: `survival/survivalModel.ts: SurvivalState`.

Далее: Минимальный расход воды одним жителем; зависит от settlement.

### 44. F: Профессии и рабочие места — MISSING

Факт: Нет назначений работников.

Основание: `survival/survivalModel.ts; machines/pumpStation/pumpStationDefinition.ts`.

Далее: Одна роль engineer у насоса; зависит от recruitment.

### 45. F: Автоматизация производства — MISSING

Факт: Есть burn топлива, но нет выпуска продукции.

Основание: `survival/survivalModel.ts: advanceSurvival`.

Далее: Добавить water production tick; зависит от station и рабочего.

### 46. F: Запасы поселения — MISSING

Факт: Ящики игрока не являются общим settlement stock.

Основание: `storage/storageModel.ts; survival/survivalModel.ts`.

Далее: Начать с единственного резервуара; не заменять ящики.

### 47. F: Водоснабжение и потребление — MISSING

Факт: Порты насоса не переносят воду.

Основание: `machines/pumpStation/pumpStationDefinition.ts; survival/survivalModel.ts`.

Далее: Литры, вместимость, выпуск/потребление; зависит от station tick.

### 48. F: Развитие поселения — MISSING

Факт: Наличие построек не образует settlement stage.

Основание: `survival/survivalModel.ts; survival/survivalStore.ts`.

Далее: Один stage после воды; зависит от progression и supplies.

### 49. F: Реакция мира на базу — MISSING

Факт: Нет реакции на развитие лагеря.

Основание: `../app/World.tsx; survival/survivalModel.ts`.

Далее: После среза добавить события по stage.

### 50. G: Система заданий — MISSING

Факт: Нет quest definitions, objectives, journal; adventure лишь doorOpened.

Основание: `adventure/adventureModel.ts: AdventureState`.

Далее: Минимальные пять objectives; зависит от доменных действий.

### 51. G: Сюжетные флаги и условия — PARTIAL

Факт: doorOpened и наличие crowbar действуют и сохраняются.

Основание: `adventure/adventureActions.ts; adventure/adventureModel.ts`.

Далее: Добавить флаги цепочки; сохранить старое приключение.

### 52. G: Цепочки заданий — DIFFERENT

Факт: Работает journal → well → crowbar → door → flask → village без quest engine.

Основание: `adventure/adventureGeneration.ts; adventure/adventureActions.ts`.

Далее: Сохранить как отдельную экспедицию; добавить целевую цепочку.

### 53. G: Сюжетные вехи — PARTIAL

Факт: Открытая дверь и награда меняют доступ; milestones среза не заданы.

Основание: `adventure/adventureModel.ts; resources/lootGeneration.ts`.

Далее: Добавить derived milestones и итог водоснабжения.

### 54. G: Альтернативные способы целей — MISSING

Факт: Для двери один tool gate; общих альтернативных objective conditions нет.

Основание: `adventure/adventureActions.ts: doorPrompt`.

Далее: После среза расширить условия ремонта/приглашения.

### 55. G: Технологии через находки — MISSING

Факт: Note — текст, state исследований отсутствует.

Основание: `exploration/noteModel.ts; survival/survivalModel.ts`.

Далее: Один unlock ремонта от чертежа или Тарика.

### 56. G: Изменения мира после заданий — PARTIAL

Факт: Дверь меняет коллизию; целевых сюжетных преобразований нет.

Основание: `placement/worldObstacles.ts; adventure/adventureActions.ts`.

Далее: Изменять NPC/насос при milestone атомарно.

### 57. H: Погода и песчаные бури — PARTIAL

Факт: Буря активируется переключателем, конечный таймер; автоматического расписания нет.

Основание: `environment/weatherModel.ts; environment/DustStorm.tsx; ../../ui/StartMenu.tsx`.

Далее: Добавить прогнозируемый scheduler при необходимости; текущую бурю сохранить.

### 58. H: Жара и среда — IMPLEMENTED

Факт: Солнце, тень, ветер, одежда, вода, костёр и температура тела.

Основание: `environment/thermalExposure.ts; survival/bodyTemperature.ts`.

Далее: Сохранить систему; проверить баланс вручную.

### 59. H: Дикие существа — MISSING

Факт: Tumbleweeds — декор, не существа.

Основание: `../app/World.tsx; vegetation/Tumbleweeds.tsx`.

Далее: Отдельная fauna system после среза.

### 60. H: Обнаружение и преследование врагами — MISSING

Факт: Нет enemy actors/sensors.

Основание: `../app/World.tsx; survival/survivalModel.ts`.

Далее: Зависит от NPC navigation и combat.

### 61. H: Ближний бой копьём — MISSING

Факт: Нет spear item или melee action.

Основание: `inventory/inventory.ts; resources/Loot.tsx`.

Далее: HP, hit tests, input, asset; зависит от damage.

### 62. H: Урон, блок и уклонение — MISSING

Факт: Прыжок не является dodge, collision не является combat.

Основание: `player/Player.tsx; survival/survivalModel.ts`.

Далее: Combat actions после правил HP и противника.

### 63. H: Избегание столкновений — MISSING

Факт: Врагов нет; обход среды не подтверждает stealth/disengage.

Основание: `../app/World.tsx; player/Player.tsx`.

Далее: Добавить агро/сброс/обход после enemies.

### 64. H: Оборонительные постройки — MISSING

Факт: Стены имеют коллизию; оборонительная функция отсутствует.

Основание: `placement/placeableItems.ts; gameObjects/gameObjectModel.ts`.

Далее: Нужны threat/health contracts; не считать декор защитой.

### 65. H: Угрозы поселению — MISSING

Факт: Нет поселения и системы атак.

Основание: `survival/survivalModel.ts; ../app/World.tsx`.

Далее: После settlement economy; не блокирует первый срез.

### 66. I: Сохранение seed и версии генератора — MISSING

Факт: Версия survival 19 и pose 1 — версии схем, не генератора.

Основание: `survival/survivalModel.ts; player/playerSave.ts; terrain/worldGeneration.ts`.

Далее: Legacy-compatible world identity; зависит от политики миграций.

### 67. I: Состояние персонажа — IMPLEMENTED

Факт: Pose отдельно; needs/inventory/clothing/stamina/temperature в survival.

Основание: `player/playerSave.ts; survival/survivalModel.ts`.

Далее: Сохранить валидацию; согласовать revision при расширении.

### 68. I: Постройки — IMPLEMENTED

Факт: Placed items и GameObjectWorld сохраняются.

Основание: `survival/survivalStore.ts: flush; survival/survivalModel.ts`.

Далее: Сохранить контракты и fixtures.

### 69. I: Изменения мира — PARTIAL

Факт: Лут, dismantled IDs, contents, door и group overrides; не произвольный world delta.

Основание: `storage/storageModel.ts; resources/lootModel.ts; survival/survivalModel.ts`.

Далее: Новые сюжетные изменения привязать к стабильным IDs.

### 70. I: NPC и поселение — MISSING

Факт: Нет соответствующих полей save.

Основание: `survival/survivalModel.ts: SurvivalState`.

Далее: Ввести версионированные состояния; зависит от NPC/settlement.

### 71. I: Прогресс заданий — PARTIAL

Факт: Сохраняется doorOpened; нет целевых objectives/unlocks.

Основание: `adventure/adventureModel.ts; survival/survivalModel.ts`.

Далее: Расширить persistent progress без потери старого adventure.

### 72. I: Восстановление после перезапуска — PARTIAL

Факт: Round-trip и reload тесты проходят; pose/survival раздельны, browser restart не проверялся.

Основание: `player/playerSave.ts; survival/survivalStore.ts; ../../tests/adventure.mjs`.

Далее: Проверить целевую цепочку с reload и согласованность слотов.

### 73. J: Логика отдельно от рендера — PARTIAL

Факт: GameObject core сериализуемый; generation использует Three MathUtils, player physics в TSX.

Основание: `gameObjects/gameObjectModel.ts; terrain/worldGeneration.ts; player/Player.tsx`.

Далее: Новые правила в чистых модулях; рабочий Player не переписывать.

### 74. J: Независимые системы — PARTIAL

Факт: Feature-каталоги есть; survivalStore координирует много доменов.

Основание: `survival/survivalStore.ts; ../app/World.tsx`.

Далее: Новые домены в отдельных модулях, store оставить facade.

### 75. J: Событийная модель — PARTIAL

Факт: subscribe/publish уведомляют UI; типизированных gameplay events нет.

Основание: `survival/survivalStore.ts: publish, apply`.

Далее: Добавить минимальные outcomes для objectives; не вводить глобальную шину без нужды.

### 76. J: Детерминированное обновление — PARTIAL

Факт: Clock накапливает >=0.25s и отдаёт весь интервал; player variable delta; exposure использует render time.

Основание: `survival/survivalClock.ts: tick; survival/Survival.tsx; player/Player.tsx`.

Далее: Для NPC/производства определить fixed domain step; replay всего мира пока не нужен.

### 77. J: Оптимизация рендеринга — IMPLEMENTED

Факт: Batching, ограниченные очереди, кеши, throttle UI/interaction.

Основание: `terrain/TerrainStream.ts; placement/ModelInstances.tsx; resources/Loot.tsx`.

Далее: Сохранить; фактический FPS неизвестен.

### 78. J: Instancing, LOD и ресурсы — IMPLEMENTED

Факт: Terrain 48/16/8, material batching, resource leases, dispose.

Основание: `terrain/terrainPlan.ts; placement/modelAssetPool.ts; shared/three/modelResources.ts`.

Далее: Сохранить ownership и проверять новые assets.

### 79. J: Автоматические тесты — IMPLEMENTED

Факт: 18 последовательно выполняемых test entrypoints, Node loader и проверки реальных GLB.

Основание: `../../package.json: scripts.test; ../../tests/module-loader.mjs`.

Далее: Расширить сценариями NPC/quest/reload; browser E2E пока нет.

## Целевая цепочка: фактический разрыв

1. Найти оазис и воду: механика берега/наполнения есть, обязательного сюжетного оазиса и objective нет.
2. Построить первый лагерь: четыре craft/place процесса есть, стартовый лагерь уже дан; важно засчитывать создание игроком, а не наличие стартового навеса.
3. Исследовать деревню: генерация, лут, discoveries есть; нет обязательной деревни и сюжетного inspect.
4. Найти и пригласить Тарика: отсутствуют персонаж, диалог, recruitment и сохранение.
5. Восстановить насос: группа и валидируемые порты есть; нет ремонтного процесса, производства, резервуара и потребителя.

Существующее приключение со скважиной — отдельный завершённый по коду цикл с полезной наградой, а не реализованная целевая сюжетная цепочка.
