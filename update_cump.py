import re

with open('src/app/components/CumplimientosExcel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove excelFilterEnabled state
text = re.sub(r'\s*const \[excelFilterEnabled, setExcelFilterEnabled\] = useState\(false\);\n', '', text)

# Remove toggleExcelFilter function
text = re.sub(r'\s*const toggleExcelFilter = \(\) => \{\n\s*setExcelFilterEnabled\(\(enabled\) => \{\n.*?\}\);\n\s*\};\n', '', text, flags=re.S)

# Remove the Filtro button
text = re.sub(r'\s*<button\s*onClick=\{toggleExcelFilter\}\s*className=\{`h-8 flex items-center justify-center gap-1\.5 px-3 rounded border text-\[10px\] font-semibold shadow-sm transition-colors \$\{.*?\}`\}\s*title=\"Filtro\"\s*>\s*<Filter className=\"w-3\.5 h-3\.5\" />\s*<span className=\"hidden sm:inline\">Filtro</span>\s*</button>', '', text, flags=re.S)

# Update renderTableHeader
# 1. Remove `excelFilterEnabled ? 'pr-7' : ''`
text = re.sub(r'\$\{excelFilterEnabled \? \'pr-7\' : \'\'\}', 'pr-7', text)
# 2. Remove `{excelFilterEnabled && (` and replace the button
new_button = '''
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openExcelColumnFilter(header.key);
          }}
          className={`absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center transition-colors border ${isFiltered ? 'bg-white border-blue-600 text-blue-700' : 'bg-transparent border-transparent text-blue-200 hover:bg-blue-800 hover:text-white'}`}
          title={`Filtrar ${header.label}`}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
'''
text = re.sub(r'\s*\{excelFilterEnabled && \(\n\s*<button\n\s*type=\"button\"\n\s*onClick=\{\(e\) => \{\n\s*e\.stopPropagation\(\);\n\s*openExcelColumnFilter\(header\.key\);\n\s*\}\}\n\s*className=\{`absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center border bg-white hover:bg-slate-100 \$\{isFiltered \? \'border-blue-600 text-blue-700\' : \'border-slate-300 text-slate-700\'\}`\}\n\s*title=\{`Filtrar \$\{header\.label\}`\}\n\s*>\n\s*<ChevronDown className=\"w-3\.5 h-3\.5\" />\n\s*</button>\n\s*\)\}', new_button, text, flags=re.S)

# 3. Remove `excelFilterEnabled &&` from the dropdown
text = re.sub(r'\{excelFilterEnabled && openTableFilter === header\.key && \(', '{openTableFilter === header.key && (', text)

# 4. Remove `const isMenuOpen = excelFilterEnabled && openTableFilter === header.key;`
text = re.sub(r'const isMenuOpen = excelFilterEnabled && openTableFilter === header\.key;', 'const isMenuOpen = openTableFilter === header.key;', text)

with open('src/app/components/CumplimientosExcel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
