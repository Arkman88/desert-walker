# Архитектурный диф

Дата: 17.11.2026. Статический аудит и успешные npm test/build; визуальная проверка и замеры FPS не выполнялись. Полная методика и матрица — [mechanics-gap-analysis.md](mechanics-gap-analysis.md).

## Что существует

`main.tsx` — точка входа. `app/App.tsx` владеет Canvas, external store, Pointer Lock, паузой и панелями; `app/World.tsx` собирает feature-компоненты. `src/features/` уже разделён по игровым системам, `src/ui/` — представление. React 19 + R3F 9 + drei 10 + Three 0.175; TypeScript 5.8, Vite (package range ^6.2.6, фактический build 6.4.6). entitymate 0.2.0 используется локально в resourceStore для скрытой подсистемы осколков; это не ECS всей игры. Python/Node scripts готовят геометрию и bounds; temp содержит исходные/вариантные assets и не является игровым runtime.

| Область | Сейчас / целевое расхождение | Решение и момент |
|---|---|---|
| Объекты | GameObject сериализует definitionId, transform, components, state. GameObjectGroup содержит members с local transforms, world transform, connections, state. Вложенных групп нет | Сохранить; для среза вложенность не нужна |
| Реестр | gameObjectCatalog регистрирует prefab и политики building/machine/ruins; core operations клонируют кандидат и валидируют его до публикации | Сохранить API и stable IDs, не заменять универсальной ECS |
| Соединения | validateGroup проверяет ссылки, socket kind/compatibility/занятость; fixed/hinge/port работают в конкретных группах. snap — только вид связи | Пространственные snap transforms/preview P1; не обещать модульный build по одному типу snap |
| Размещение | groundPlacementAt проверяет 5×5 footprint, воду, перепады и obstacles. AssemblyRules не заменяют мировую физическую проверку; у machine validatePlacement безусловно accepted | P0 для сюжетной площадки: route/access проверки; P1 для свободного монтажа — placement policy |
| Смешанные данные | Хижины/машина/руины в GameObjectWorld; portable camp items, inventory и containers имеют отдельные устойчивые модели | Допустимо оставить; не мигрировать все предметы в группы ради единообразия |
| Рендер/логика | GameObject core не зависит от Three/React; hutRenderAdapter связывает части с существующими узлами GLB. Player объединяет input/camera/physics, генерация использует Three MathUtils | Новую экономику/NPC/quest писать чистыми доменными модулями; выделять Player только при необходимости, P1 |
| Мир | heightAt/hash фиксированы; terrain worker обслуживает LOD; отдельно location/expedition/ruin generation, bounded spatial caches | Сохранить генераторы; P0 добавить world identity и обязательные anchors, legacy результат не менять |
| Процедурные groups | Руины создаются фабрикой и rules, имеют seed/layout, loot anchors, проходы и sparse saved overrides; не каждый generated group хранится в snapshot | Сохранить lazy generation; P0 версионировать ID/overrides новых сюжетных точек |
| Цикл | R3F useFrame раздельно ведёт player, survival, lights, VFX. Survival clock отдаёт весь накопленный интервал от 0.25 s, а не серию одинаковых fixed ticks; delta >1 сбрасывается | Для первого инженера достаточно доменных ticks без replay; P1 фиксировать шаг production/NPC. Не переписывать VFX clock |
| Среда | Survival считает needs/temperature с elapsedSeconds, render time, shelter/occlusion/fire. Sleep отдельно ускоряет эту же модель | Сохранить sleep/thermal integration; после добавления производства решить, как оно идёт во сне, P0 |
| State | createSurvivalStore — facade команд, apply/dirty/flush, кэш производных obstacles/sites, подписки useSyncExternalStore | Facade оставить, новые reducers/actions в своих features; не раздувать store бизнес-правилами |
| События | subscribe/publish — invalidation UI, не domain event log. Прямые store commands уже дают место фиксации успешного результата | P0 минимальные typed outcomes либо derived objectives; полная event bus не обязательна |
| NPC | Нет ActorState, dialogue, navigation, recruitment | P0 один persistent NPC и дискретный переход; не вводить navmesh ради первого диалога |
| Progression | AdventureState содержит только doorOpened; направляющие записки не quest engine | P0 пять objectives, persistent flags/unlock; старый adventure сохранить независимо |
| Насос | createPumpStation даёт уже смонтированные части/порты; DEV circuit toggle меняет видимость/коллизию; durability не производит ремонт сама | P0 отдельно определить damaged/repaired/operating и output воды. Не превращать debug-кнопку в финальное действие |
| Persistence | survival schema 19 + pose schema 1 + resource save schema 1 в разных localStorage keys. parse/flush валидируют мир, invalid save блокируется и доступен для export/backup. Некоторые обновления контента делаются внутри schema 19 | Сохранить защиту. P0 явная миграция новых доменов, legacy world identity, revision/согласованность слотов; не менять текущий формат в рамках аудита |
| Загрузка | parseSurvivalSave очищает navigation.markers/nextMarkerId, вносятся upgradeHouseGameplay/upgradeRuinCrates/withPumpStation | Документировать эти нормализации; сохранение — не побитовое восстановление произвольного state |
| GPU | TerrainStream два worker, LRU 64 MiB/900 entries, installation budget 2 ms/2 chunks, LOD hysteresis. Model pool leases учитывают поздний async resolve, geometry/material/texture dispose | Сохранить ownership. Cache byte limit — вычисленная геометрия, не весь GPU budget; FPS не установлен |
| Проверки | 18 Node suites, включая реальные GLB и fake workers/storage, строгий tsc; browser E2E и lint отсутствуют | P0 расширить existing tests для всей цепочки и reload. Визуальную проверку оставлять пользователю |

## Минимальная целевая надстройка

Существующий World и streaming → обязательные сюжетные anchors → доменные actions (вода/лагерь/inspect/recruit/repair) → небольшой progress reducer → сохранение существующим facade. NPC и settlement размещать в новых feature-каталогах; UI только отображает результат и посылает команды. Для насоса использовать текущие group/ports/render/collider, а производительность и литры хранить доменными числами. События фиксировать после успешной команды, чтобы отказ crafting, повторное E и reload не давали прогресс дважды.

Не требуется глобальное переписывание мира, физики, рендера, inventory, storage или сохранений. Новые форматы — отдельная будущая задача с миграциями и тестами. Архитектурные пробелы не являются обнаруженными build-ошибками.
