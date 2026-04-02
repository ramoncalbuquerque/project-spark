

# Correção de 3 Bugs de Interação — WeekView & DayView

## Resumo

Três bugs impedem a criação de cards em slots ocupados e o drag-to-move. As correções envolvem 4 arquivos, sem tocar em modal, sidebar, MonthView ou banco.

## Bug 1 — Criação em slot ocupado

**Causa:** Card único recebe `width: 100%`, cobrindo todo o slot. O `stopPropagation` do CalendarCard bloqueia o clique no slot.

**Correção em `calendarUtils.ts`:**
- Quando `maxCol === 1`, usar `width: "calc(92% - 0px)"` em vez de `100%`.
- Quando `maxCol > 1`, manter cálculo proporcional mas com cap de 92% por card.
- `left` permanece inalterado.

## Bug 2 — Drag-to-move não funciona

**Causa dupla:**
1. `handlePointerLeave` no CalendarCard cancela o timer de long-press quando o cursor sai do card (antes dos 500ms).
2. Mesmo quando o timer dispara, `onMovePointerMove` depende de `onMouseEnter` nos slots, que ficam bloqueados pelo card absolutamente posicionado.

**Correção em `CalendarCard.tsx`:**
- Remover a chamada a `onLongPressCancel` do `handlePointerLeave`. O cancelamento só acontece no `handlePointerUp` (clique curto sem drag).

**Correção em `useDragMove.ts`:**
- Quando `isDraggingMove` se torna `true` (dentro do setTimeout), registrar `pointermove` e `pointerup` listeners no `document`.
- No `pointermove`: usar `document.elementFromPoint(e.clientX, e.clientY)` para encontrar o slot sob o cursor, lendo `data-hour` e `data-day` do elemento.
- No `pointerup`: executar o drop e remover os listeners do document.
- Remover a dependência de `onMovePointerMove` e `onMovePointerUp` serem chamados pelos slots.

**Correção em `WeekView.tsx` e `DayView.tsx`:**
- Adicionar `data-day={day.toISOString()}` em cada slot div (WeekView já tem `data-hour`; DayView precisa de `data-day` também).

## Bug 3 — Drag-to-select em slots com cards

**Causa:** Mesma do Bug 1 (card cobre o slot).

**Correção:** Já resolvida pelo Bug 1 (width 92%). Adicionalmente:
- Em `WeekView.tsx` e `DayView.tsx`: quando `drag` do `useDragSelect` estiver ativo (não-null), adicionar classe `pointer-events-none` no wrapper dos cards posicionados.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/calendar/calendarUtils.ts` | Width máximo 92% para cards (single e multi) |
| `src/components/calendar/CalendarCard.tsx` | Remover `onLongPressCancel` do `handlePointerLeave` |
| `src/hooks/useDragMove.ts` | Document-level listeners para pointermove/pointerup durante drag |
| `src/components/calendar/WeekView.tsx` | `data-day` nos slots, `pointer-events-none` nos cards durante drag-select |
| `src/components/calendar/DayView.tsx` | `data-day` nos slots, `pointer-events-none` nos cards durante drag-select |

## Detalhes técnicos

**useDragMove — document listeners:**
```text
setTimeout callback (500ms):
  isDraggingMove = true
  setDragMove(...)
  
  const onDocMove = (e: PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const slot = el?.closest('[data-hour]')
    if (slot) {
      hour = Number(slot.dataset.hour)
      day = new Date(slot.dataset.day)
      setDragMove(prev => ({...prev, currentDay: day, currentHour: hour}))
    }
  }
  
  const onDocUp = () => {
    // execute drop logic
    document.removeEventListener('pointermove', onDocMove)
    document.removeEventListener('pointerup', onDocUp)
  }
  
  document.addEventListener('pointermove', onDocMove)
  document.addEventListener('pointerup', onDocUp)
```

**calendarUtils — width cap:**
```text
// Dentro do loop de groups:
const widthPercent = Math.min((1 / maxCol) * 100, 92);
width: `calc(${widthPercent}% - ${gapPx * 2}px)`
```

**WeekView/DayView — pointer-events durante drag-select:**
Importar `drag` do `useDragSelect` e aplicar no wrapper dos cards:
```text
<div className={`absolute z-[5] px-0.5 ${drag ? 'pointer-events-none' : ''}`} ...>
```

