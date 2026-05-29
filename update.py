import re

with open('src/app/components/CumplimientosExcel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add import
import_stmt = "import { SortDirection, DateFilterTreeNode, MONTH_NAMES, TriStateCheckbox, parseSortDate, parseDateFilterOption, buildDateFilterTree, getFilterMenuSortLabel } from './FilterUtils';\n"

# Replace imports (add after the first import)
text = re.sub(r'^(import .*?\n)', r'\1' + import_stmt, text, count=1)

# Remove TriStateCheckbox
text = re.sub(r'function TriStateCheckbox.*?return \(\n.*?<input.*?/>\n.*?\);\n}\n', '', text, flags=re.S)

# Remove SortDirection
text = re.sub(r'type SortDirection = \'ASC\' \| \'DESC\';\n', '', text)

# Remove DateFilterTreeNode
text = re.sub(r'type DateFilterTreeNode = \{\n  id: string;\n  label: string;\n  values: string\[\];\n  children\?: DateFilterTreeNode\[\];\n\};\n', '', text)

# Remove MONTH_NAMES
text = re.sub(r'const MONTH_NAMES = \[\n.*?\];\n', '', text, flags=re.S)

# Remove parseSortDate
text = re.sub(r'function parseSortDate\(dateStr: unknown\): number \| null \{.*?return null;\n\}\n', '', text, flags=re.S)

# Remove parseDateFilterOption
text = re.sub(r'function parseDateFilterOption\(option: string\) \{.*?\}\n', '', text, flags=re.S)

# Remove buildDateFilterTree
text = re.sub(r'function buildDateFilterTree\(options: string\[\]\): DateFilterTreeNode\[\] \{.*?return yearNodes;\n\}\n', '', text, flags=re.S)

# Remove getFilterMenuSortLabel
text = re.sub(r'function getFilterMenuSortLabel\(column: ReturnType<typeof getSortColumn>, direction: SortDirection\) \{.*?\}\n', '', text, flags=re.S)

with open('src/app/components/CumplimientosExcel.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
