# Menú inferior con pestañas expandibles

## Objetivo
Aplicar al menú inferior existente el efecto de pestañas expandibles del componente proporcionado, sin usar BorderBeam ni cambiar los cuatro destinos.

## Cambios
- Crear el componente reutilizable de pestañas expandibles en la carpeta UI del proyecto.
- Adaptarlo para que la pestaña activa corresponda siempre a la pantalla actual y conserve la navegación existente.
- Sustituir únicamente la presentación interna del menú inferior: iconos compactos y nombre visible en la pestaña activa con animación suave.
- Mantener Inicio, Liga, Apuestas y Perfil, así como el dock flotante, los temas claro/oscuro y las tipografías actuales.
- Añadir solo las dependencias necesarias para la animación y la detección de clic exterior.

## Verificación
- Comprobar los cuatro accesos y el estado activo en móvil.
- Confirmar que la animación no desborda ni solapa el contenido.
- Revisar ambos temas y que la aplicación compile sin errores.

## Detalles técnicos
- La variante integrada aceptará enlaces y un índice activo controlado por la ruta, en lugar de depender únicamente de estado local.
- Se respetarán los colores semánticos existentes y la reducción de movimiento configurada por el dispositivo.
