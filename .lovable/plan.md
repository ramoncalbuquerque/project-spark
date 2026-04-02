## Plano: Grade do Calendário — /dashboard

### Arquitetura

**Novo contexto**: `CalendarContext` — estado compartilhado entre Dashboard e MiniCalendar
- `selectedDate`, `viewMode` ('day'|'week'|'month', default 'week')
- Funções: `goToToday()`, `goNext()`, `goPrev()`, `setSelectedDate()`, `setViewMode()`

### Componentes novos

| Componente | Responsabilidade |
|------------|-----------------|
| `CalendarContext` | Estado global do calendário |
| `CalendarToolbar` | Setas ◀▶, label período, botão "Hoje", abas Dia/Semana/Mês |
| `WeekView` | Grade 7 colunas × 16 slots (06-22h), zebrado, dia atual verde, linha "agora" vermelha |
| `DayView` | Coluna única, mesmos slots, linha "agora" |
| `MonthView` | Grade 5×7, dias fora do mês cinza, dia atual verde |

### Detalhes

- **WeekView**: header com horas (w-16) + 7 cols flex-1. Slots h-[60px], zebrado. Coluna dia atual bg-primary/5. Linha "agora" absolute, atualiza cada 60s. Scroll inicial ~08:00.
- **Navegação**: Semana ±7d, Dia ±1d, Mês ±1 mês. Labels dinâmicos.
- **MiniCalendar**: onClick chama setSelectedDate, destaque no dia selecionado.
- **CalendarProvider** no AppLayout.

### Arquivos
- Novos: CalendarContext, CalendarToolbar, WeekView, DayView, MonthView
- Alterados: MiniCalendar, AppLayout, Dashboard
- Sem tocar: sidebar, header, rotas, auth