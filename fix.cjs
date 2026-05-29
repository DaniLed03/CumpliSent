const fs = require('fs');
let content = fs.readFileSync('src/app/App.tsx', 'utf-8');

const brokenStr = `          {currentView === "usuarios" && (
            <UserManagement
              canCreate={can("users.create")}
              canEdit={can("users.edit")}
              canAssignMesa={can("mesas.assign_users")}
            />
          )}
          {currentView === "roles" && (
            <RolePermissions
              canCreate={can("roles.create")}
              canEdit={can("roles.edit")}
              canAssignPermissions={can("roles.permissions")}
            />
          )}`;

const fixedStr = `          {currentView === "dias-inhabiles" && (
            <DiasInhabilesView
              diasInhabiles={diasInhabiles}
              setDiasInhabiles={setDiasInhabiles}
              canManage={can("dias_inhabiles.manage")}
            />
          )}
          {currentView === "servidor" && <ServerConfig canManage={isAdmin} />}
          {currentView === "usuarios" && (
            <UserManagement
              canCreate={can("users.create")}
              canEdit={can("users.edit")}
              canAssignMesa={can("mesas.assign_users")}
            />
          )}
          {currentView === "roles" && (
            <RolePermissions
              canCreate={can("roles.create")}
              canEdit={can("roles.edit")}
              canAssignPermissions={can("roles.permissions")}
            />
          )}
          {currentView === "mesas" && (
            <MesasTramite permissions={permissions} isAdmin={isAdmin} session={session} />
          )}
          {currentView === "trabajo-diario" && (
            <TrabajoDiario permissions={permissions} isAdmin={isAdmin} session={session} />
          )}`;

// It's safer to just slice and reconstruct the end.
const endOfDias = content.indexOf('{currentView === "dias-inhabiles" && (');
if (endOfDias !== -1) {
  content = content.slice(0, endOfDias) + fixedStr + `\n        </section>\n      </main>\n    </div>\n  );\n}\n`;
  fs.writeFileSync('src/app/App.tsx', content);
  console.log('Fixed App.tsx successfully');
} else {
  console.log('Could not find the target to replace');
}
