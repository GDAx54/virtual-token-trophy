# Renovación visual minimalista y temas

## Objetivo
Actualizar visiblemente la aplicación sin alterar el funcionamiento, los nombres de equipos ni la presentación tipográfica de las cuotas.

## Cambios
- Convertir el menú inferior plano en un dock flotante compacto, con fondo translúcido, separación del borde y estado activo en forma de cápsula suave.
- Mantener los cuatro destinos, sus nombres e iconos actuales; mejorar jerarquía, espacios y respuesta táctil.
- Añadir un control de tema claro/oscuro accesible desde la cabecera.
- Recordar la preferencia del usuario y, en la primera visita, respetar la configuración del dispositivo.
- Definir una paleta clara propia que conserve el verde de 90x, junto con la paleta oscura actual refinada.
- Ajustar superficies, sombras y fondo general para que tarjetas, cabecera y menú se lean correctamente en ambos modos.
- Mantener intactos los componentes que dibujan nombres de equipos y cuotas.

## Verificación
- Comprobar inicio y navegación inferior en móvil, tanto en claro como en oscuro.
- Confirmar que el tema persiste al recargar y que no hay solapamientos con el contenido.
- Revisar que la aplicación compile sin errores.

## Detalles técnicos
- El tema se aplicará con una clase global y variables semánticas, sin duplicar estilos por pantalla.
- El selector será un botón de icono con etiqueta accesible; no se modificará la lógica de partidos, apuestas o ligas.
