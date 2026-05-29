import re

with open('src/app/components/TrabajoDiario.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add imports for ArrowUpDown, FilterUtils, etc.
if 'ArrowUpDown' not in text:
    text = re.sub(r'import \{([^\}]+)\} from \'lucide-react\';', r'import {\1, ArrowUpDown} from \'lucide-react\';', text)

text = re.sub(r'^(import .*?\n)', r'\1import { SortDirection, DateFilterTreeNode, MONTH_NAMES, TriStateCheckbox, parseSortDate, parseDateFilterOption, buildDateFilterTree, getFilterMenuSortLabel } from \'./FilterUtils\';\n', text, count=1)

# Add expandedDateFilterNodes, sortLevels, etc. state
state_code = """
  const [expandedDateFilterNodes, setExpandedDateFilterNodes] = useState<Record<string, boolean>>({});
  const [sortLevels, setSortLevels] = useState<Array<{ id: string; column: string; direction: SortDirection }>>([]);
  const [draftSortLevels, setDraftSortLevels] = useState<Array<{ id: string; column: string; direction: SortDirection }>>([]);

  const renderDateFilterTreeNode = (node: DateFilterTreeNode, depth = 0) => {
    const hasChildren = Boolean(node.children?.length);
    const expanded = expandedDateFilterNodes[node.id] ?? false;
    const selectedCount = node.values.filter((value) => draftTableFilterValues.includes(value)).length;
    const checked = node.values.length > 0 && selectedCount === node.values.length;
    const indeterminate = selectedCount > 0 && selectedCount < node.values.length;

    return (
      <div key={node.id} style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: depth === 0 ? 6 : 6,
          top: hasChildren && expanded ? 18 : 0,
          bottom: 0,
          width: 1,
          borderLeft: '1px dotted #999',
          display: 'none',
        }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 22,
            paddingLeft: 4,
            borderRadius: 3,
            cursor: 'pointer',
            marginBottom: 1,
          }}
          className="hover:bg-slate-50"
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedDateFilterNodes((prev) => ({ ...prev, [node.id]: !expanded }));
              }}
              style={{
                width: 11,
                height: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #999',
                backgroundColor: '#fff',
                fontSize: 9,
                marginRight: 4,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {expanded ? '-' : '+'}
            </button>
          ) : (
            <span style={{ display: 'inline-block', width: 11, height: 11, marginRight: 4, flexShrink: 0 }} />
          )}
          <TriStateCheckbox
            checked={checked}
            indeterminate={indeterminate}
            onChange={(nextChecked) => {
              setDraftTableFilterValues((current) => {
                const withoutNode = current.filter((value) => !node.values.includes(value));
                return nextChecked ? [...withoutNode, ...node.values] : withoutNode;
              });
            }}
          />
          <span style={{ marginLeft: 4, fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: depth === 0 ? 600 : 500 }}>
            {node.label}
          </span>
        </div>

        {hasChildren && expanded && (
          <div style={{ paddingLeft: 10, position: 'relative' }}>
            {node.children?.map((child) => renderDateFilterTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };
"""

text = re.sub(r'const \[tableFilterSearch, setTableFilterSearch\] = useState\(\'\'\);\n', r'const [tableFilterSearch, setTableFilterSearch] = useState(\'\');\n' + state_code, text)

# Replace renderTableHeader
new_render_header = """
  const renderTableHeader = (key: string, label: string, type: 'date' | 'text' | 'number' | 'estatus' | 'boolean', className: string, title?: string) => {
    const isFiltered = !!tableColumnFilters[key];
    const isOpen = openTableFilter === key;
    const allOptions = isOpen ? getTableFilterOptions(key) : [];
    const search = tableFilterSearch.toLowerCase();
    
    const visibleOptionsTs = allOptions.filter((option) => {
      if (!search) return true;
      if (type !== 'date') {
        return option.toLowerCase().includes(search);
      }
      const parsed = parseDateFilterOption(option);
      if (!parsed) {
        return option.toLowerCase().includes(search);
      }
      const searchable = [
        option,
        String(parsed.year),
        MONTH_NAMES[parsed.month],
        String(parsed.day),
        String(parsed.day).padStart(2, '0'),
      ].join(' ').toLowerCase();
      return searchable.includes(search);
    });

    const allVisibleSelected = visibleOptionsTs.length > 0 && visibleOptionsTs.every(o => draftTableFilterValues.includes(o));
    const dateTree = type === 'date' ? buildDateFilterTree(visibleOptionsTs) : [];

    return (
      <th key={key} className={`${className} relative group`} title={title}>
        <span className="block whitespace-nowrap truncate leading-tight">{label}</span>
        <button
          onClick={(e) => { e.stopPropagation(); openExcelFilter(key); }}
          className={`absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center transition-colors border ${isFiltered ? 'bg-white border-blue-600 text-blue-700' : 'bg-transparent border-transparent text-blue-200 hover:bg-blue-800 hover:text-white'}`}
          title={`Filtrar ${label}`}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {isOpen && (
          <div
            className="absolute z-50 top-full left-0 mt-1 w-[340px] bg-white text-slate-900 border border-slate-200 rounded-xl shadow-2xl normal-case text-left ring-1 ring-black/5 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 tracking-wide uppercase truncate">{label}</p>
            </div>

            <div className="p-3 space-y-1">
              {(['ASC', 'DESC'] as SortDirection[]).map((direction) => (
                <button
                  key={direction}
                  className="w-full flex items-center gap-2 text-left px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
                  onClick={() => {
                    const nextSort = [{ id: `filtro-${Date.now()}`, column: key, direction }];
                    setSortLevels(nextSort);
                    setDraftSortLevels(nextSort);
                    setOpenTableFilter(null);
                  }}
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{getFilterMenuSortLabel(type, direction)}</span>
                </button>
              ))}
            </div>

            <div className="h-px bg-slate-200" />

            <div className="p-3">
            <input
              value={tableFilterSearch}
              onChange={(e) => setTableFilterSearch(e.target.value)}
              placeholder="Buscar"
              className="w-full h-9 border border-slate-300 rounded-md px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 mb-2 placeholder:text-slate-400"
            />

            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500">
                  {draftTableFilterValues.length} DE {allOptions.length} SELECCIONADOS
                </span>
                {tableFilterSearch && (
                  <button
                    onClick={() => setTableFilterSearch('')}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    LIMPIAR BUSQUEDA
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto p-1.5 text-xs">
              {type !== 'date' && (
                <label className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-blue-50 font-semibold text-slate-800 cursor-pointer">
                  <TriStateCheckbox
                    checked={allVisibleSelected}
                    indeterminate={
                      visibleOptionsTs.some((option) => draftTableFilterValues.includes(option)) && !allVisibleSelected
                    }
                    onChange={(checked) => {
                      setDraftTableFilterValues((current) => {
                        const withoutVisible = current.filter((value) => !visibleOptionsTs.includes(value));
                        return checked ? [...withoutVisible, ...visibleOptionsTs] : withoutVisible;
                      });
                    }}
                  />
                  (Seleccionar todo)
                </label>
              )}

              {visibleOptionsTs.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-slate-400">
                  No hay coincidencias
                </div>
              ) : type === 'date' ? (
                <div style={{ userSelect: 'none', fontSize: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: 22,
                      paddingLeft: 4,
                      borderRadius: 3,
                      cursor: 'pointer',
                      marginBottom: 1,
                    }}
                    className="hover:bg-slate-50"
                  >
                    <span style={{ display: 'inline-block', width: 11, height: 11, marginRight: 4, flexShrink: 0 }} />
                    <TriStateCheckbox
                      checked={allVisibleSelected}
                      indeterminate={
                        visibleOptionsTs.some((option) => draftTableFilterValues.includes(option)) && !allVisibleSelected
                      }
                      onChange={(checked) => {
                        setDraftTableFilterValues((current) => {
                          const withoutVisible = current.filter((value) => !visibleOptionsTs.includes(value));
                          return checked ? [...withoutVisible, ...visibleOptionsTs] : withoutVisible;
                        });
                      }}
                    />
                    <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600, color: '#1e293b' }}>(Seleccionar todo)</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: 10,
                      top: 0,
                      bottom: 11,
                      width: 1,
                      borderLeft: '1px dotted #999',
                    }} />
                    {dateTree.map((node, idx) => (
                      <div key={node.id} style={{ position: 'relative' }}>
                        <div style={{
                          position: 'absolute',
                          left: 10,
                          top: 11,
                          width: 8,
                          height: 1,
                          borderTop: '1px dotted #999',
                        }} />
                        <div style={{ paddingLeft: 18 }}>
                          {renderDateFilterTreeNode(node, 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                visibleOptionsTs.map((option) => {
                  const checked = draftTableFilterValues.includes(option);
                  return (
                    <label
                      key={option}
                      className={`flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer transition-colors ${checked ? 'bg-blue-50 text-slate-900' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setDraftTableFilterValues((current) =>
                            e.target.checked
                              ? [...current, option]
                              : current.filter((value) => value !== option)
                          );
                        }}
                        className="w-3.5 h-3.5 accent-blue-600"
                      />
                      <span className="truncate font-medium">{option}</span>
                    </label>
                  );
                })
              )}
              </div>
              <div className="p-2 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
               <button onClick={() => setOpenTableFilter(null)} className="px-3 py-1.5 rounded border border-slate-300 hover:bg-white font-semibold text-xs text-slate-700">Cancelar</button>
               <button onClick={applyExcelColumnFilter} className="px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 font-semibold shadow-sm text-xs">ACEPTAR</button>
              </div>
            </div>
          </div>
          </div>
        )}
      </th>
    );
  };
"""

text = re.sub(r'const renderTableHeader = \(key: string, label: string, className: string, title\?: string\) => \{.*?\n  \};\n', new_render_header, text, flags=re.S)

# Update the table headers array in the JSX:
headers_replacements = [
    (r"\{renderTableHeader\('numeroOrden', 'No. Orden', 'px-3 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap'\)\}", r"{renderTableHeader('numeroOrden', 'No. Orden', 'number', 'px-3 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}"),
    (r"\{renderTableHeader\('juicio', 'Juicio / Expediente', 'px-3 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap'\)\}", r"{renderTableHeader('juicio', 'Juicio / Expediente', 'text', 'px-3 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}"),
    (r"\{renderTableHeader\('mesa', 'Mesa', 'px-4 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap'\)\}", r"{renderTableHeader('mesa', 'Mesa', 'text', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}"),
    (r"\{renderTableHeader\('persona', 'Persona', 'px-4 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap'\)\}", r"{renderTableHeader('persona', 'Persona', 'text', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}"),
    (r"\{renderTableHeader\('ultimoRequerimiento', 'Último Requerimiento', 'px-4 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap'\)\}", r"{renderTableHeader('ultimoRequerimiento', 'Último Requerimiento', 'date', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}"),
    (r"\{renderTableHeader\('diasNaturales', 'Días Naturales', 'px-4 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap', 'Días Naturales Transcurridos'\)\}", r"{renderTableHeader('diasNaturales', 'Días Naturales', 'number', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap', 'Días Naturales Transcurridos')}"),
    (r"\{renderTableHeader\('diasHabiles', 'Días Hábiles', 'px-4 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap', 'Días Hábiles Transcurridos'\)\}", r"{renderTableHeader('diasHabiles', 'Días Hábiles', 'number', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap', 'Días Hábiles Transcurridos')}"),
    (r"\{renderTableHeader\('fechaAcuerdo', 'Fecha Acuerdo', 'px-4 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap'\)\}", r"{renderTableHeader('fechaAcuerdo', 'Fecha Acuerdo', 'date', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}"),
    (r"\{renderTableHeader\('estatus', 'Estatus', 'px-4 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap'\)\}", r"{renderTableHeader('estatus', 'Estatus', 'estatus', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}"),
    (r"\{renderTableHeader\('observaciones', 'Observaciones Trabajo Diario', 'px-4 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap'\)\}", r"{renderTableHeader('observaciones', 'Observaciones Trabajo Diario', 'text', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}"),
    (r"\{renderTableHeader\('capturadoPor', 'Capturado Por', 'px-4 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap'\)\}", r"{renderTableHeader('capturadoPor', 'Capturado Por', 'text', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}"),
    (r"\{renderTableHeader\('fechaCaptura', 'Fecha Captura', 'px-4 py-3 text-left text-\[9px\] font-semibold uppercase tracking-wider whitespace-nowrap'\)\}", r"{renderTableHeader('fechaCaptura', 'Fecha Captura', 'date', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}"),
]

for pat, repl in headers_replacements:
    text = re.sub(pat, repl, text)

# Add sorting to the filtering chain
parse_sort_number = """
function parseSortNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (text === '') {
    return null;
  }
  const numeric = Number(text.replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}
"""

if 'parseSortNumber' not in text:
    text += parse_sort_number

sort_logic = """
  const sortedExpedientes = useMemo(() => {
    let result = [...filteredExpedientesExcel];
    for (let i = sortLevels.length - 1; i >= 0; i--) {
      const { column, direction } = sortLevels[i];
      result.sort((a, b) => {
        let valA = getTableFilterValue(a, column);
        let valB = getTableFilterValue(b, column);

        if (column === 'diasNaturales' || column === 'diasHabiles' || column === 'numeroOrden') {
          const numA = parseSortNumber(valA) ?? -Infinity;
          const numB = parseSortNumber(valB) ?? -Infinity;
          return direction === 'ASC' ? numA - numB : numB - numA;
        }

        if (column === 'fechaAcuerdo' || column === 'fechaCaptura' || column === 'ultimoRequerimiento') {
          const numA = parseSortDate(valA) ?? -Infinity;
          const numB = parseSortDate(valB) ?? -Infinity;
          return direction === 'ASC' ? numA - numB : numB - numA;
        }

        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();
        return direction === 'ASC' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }
    return result;
  }, [filteredExpedientesExcel, sortLevels, getTableFilterValue]);

  const filteredExpedientes = sortedExpedientes.filter(exp => {
"""

text = re.sub(r'  const filteredExpedientes = expedientes\.filter\(exp => \{\n.*?\n  \}\)\.filter\(exp => filteredExpedientesExcel\.includes\(exp\)\);', sort_logic + r"""    const matchesSearch = 
      String(exp.numeroJuicio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(exp.numeroOrden || '').includes(searchQuery);

    const matchesMesa = 
      !can('trabajo.view_all_mesas') || 
      !selectedMesaFilter || 
      Number(exp.idMesa) === Number(selectedMesaFilter);

    return matchesSearch && matchesMesa;
  });""", text, flags=re.S)

with open('src/app/components/TrabajoDiario.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
