/**
 * Modelos para CU-09 (Modelado visual de flujos), CU-10 (Reglas de decisión)
 * y CU-11 (Formularios dinámicos).
 *
 * Alineado al enfoque del compañero (nodo = paso ejecutable con orden,
 * formulario y condición), NO al enfoque UML estricto anterior.
 */

/** Tipo global del flujo (definido en la Política). */
export type TipoFlujo = 'secuencial' | 'lineal' | 'iterativo';

/** Carril (swimlane / ActivityPartition) del diagrama UML. */
export interface Carril {
  id: string;
  nombre: string;
  color?: string;
  departamentoId?: string;
  /** Funcionario actualmente asignado a este carril (rotativo) */
  funcionarioAsignadoId?: string;
  funcionarioAsignadoNombre?: string;
}

/** Tipo de nodo en el diagrama de actividad UML. */
export type TipoPaso = 'INICIO' | 'FIN' | 'TAREA' | 'GATEWAY';

/** Un Paso / Actividad / Nodo del diagrama (CU-09). */
export interface Paso {
  id: string;
  politicaId: string;
  /** Orden visible numerado en el header del nodo (1, 2, 3, ...). */
  orden: number;
  /** Nombre mostrado en el header del nodo (ej: "Bienvenida", "Datos del cliente"). */
  nombre: string;
  /** Formulario asociado (CU-11). Puede ser null si aún no se creó. */
  formularioId?: string | null;
  /** Departamento responsable de ejecutar este paso (opcional). */
  departamentoId?: string | null;
  /** Paso obligatorio para avanzar. */
  obligatorio: boolean;
  /** Posición en el canvas (persistida). */
  x: number;
  y: number;
  /** Marca si es el paso final (último paso del flujo). */
  esUltimo?: boolean;
  /** Tipo UML del nodo: INICIO (InitialNode), FIN (FinalNode), TAREA (Action), GATEWAY (Decision). */
  tipoPaso?: TipoPaso;
  /** Tipo de campo inline: cuando el nodo representa UN SOLO dato en el diagrama. */
  campotipo?: TipoCampo;
  /** Campos embebidos directamente en el nodo (alternativa a formularioId). */
  campos?: CampoFormulario[];
}

/**
 * Relación entre dos pasos (arista del diagrama).
 * Representa CU-09 (flujo) y CU-10 (condición opcional).
 * Equivale al documento FlujoRelacion del compañero (politicaId, padreId, destinoId).
 */
export interface FlujoRelacion {
  id: string;
  politicaId: string;
  padreId: string;      // nodo origen
  destinoId: string;    // nodo destino
  /** Tipo de arista: 'siguiente' (naranja), 'condicional' (morada punteada) o 'hijo' (jerarquía). */
  tipo: 'siguiente' | 'condicional' | 'hijo';
  /** CU-10: regla opcional evaluada contra el formulario del nodo padre. */
  condicion?: ReglaCondicion | null;
  /** Para renderizar puerto (salida) específico del padre. */
  puertoSalida?: string;
}

/** Regla de decisión simple (CU-10) al estilo del modal "Editar condición de la conexión". */
export type OperadorCondicion = '=' | '!=' | '>' | '<' | '>=' | '<=';

/** Variables de sistema para condiciones no basadas en campos del formulario. */
export type VariableSistemaCondicion =
  | 'estado_anterior'
  | 'rol_solicitante'
  | 'departamento_solicitante'
  | 'dias_transcurridos'
  | 'fecha_actual';

/** Fuente de la condición: campo del formulario o variable de sistema. */
export type FuenteCondicion = 'campo_formulario' | 'variable_sistema';

export interface ReglaCondicion {
  /** Id del campo dentro del formulario del paso padre. */
  campoId: string;
  /** Valor esperado para que la rama se active. Vacío => rama "siempre". */
  valorEsperado: string;
  /** Operador. Por defecto "=". */
  operador?: OperadorCondicion;
  /** Permite soportar condiciones de estado/rol/tiempo sin depender de un campo del formulario. */
  fuente?: FuenteCondicion;
  /** Variable de sistema a evaluar cuando fuente === 'variable_sistema'. */
  variableSistema?: VariableSistemaCondicion;
}

/** Tipos de campo soportados (visibles en el modal "Nuevo campo" del compañero). */
export type TipoCampo =
  | 'texto'
  | 'texto_largo'
  | 'numero'
  | 'lista'
  | 'si_no'
  | 'fecha'
  | 'archivo'
  | 'firma'
  | 'label'
  | 'grid';

/** Formato de opción para listas. */
export interface OpcionCampo {
  label: string;
  valor: string;
}

/** Columna (cabecera) de una tabla/grid, definida por el diseñador. */
export interface ColumnaTabla {
  id: string;
  titulo: string;
  /** Tipo de dato que el cliente ingresa en esta columna. */
  tipo?: 'texto' | 'numero';
}

/** Fila predefinida de una tabla/grid (la etiqueta la fija el diseñador, los valores los llena el cliente). */
export interface FilaTabla {
  id: string;
  etiqueta: string;
}

/** Campo de un formulario (CU-11). */
export interface CampoFormulario {
  id: string;
  formularioId: string;
  tipo: TipoCampo;
  titulo: string;
  placeholder?: string;
  /** Descripción fija debajo del campo (instrucciones). */
  descripcion?: string;
  obligatorio: boolean;
  orden: number;
  /** Opciones para campo tipo lista. */
  opciones?: OpcionCampo[];
  /** Permite que el usuario seleccione varias opciones en un campo tipo lista. */
  multiple?: boolean;
  /** Para tipo archivo: extensiones permitidas (ej: ".pdf,.jpg"). */
  formatos?: string;
  /** Para tipo fecha: 'corta' (DD/MM/YYYY) o 'larga' (D de MMMM de YYYY). */
  formatoFecha?: 'corta' | 'larga';
  /** Para tipo fecha: incluye selector de hora. */
  incluyeHora?: boolean;
  /** Para tipo numero: valor mínimo permitido. */
  min?: number;
  /** Para tipo numero: valor máximo permitido. */
  max?: number;
  /** Para tipo numero: 'celular', 'cuenta', 'pago' o 'general'. */
  subtipoNumero?: 'celular' | 'cuenta' | 'pago' | 'general';
  /** Para tipo numero: unidad visible (Bs., %, m2). */
  prefijoSufijo?: string;
  /** Para tipo lista: permite escribir una opción no listada. */
  permitirOtro?: boolean;
  /** Para tipo archivo: límite de archivos adjuntos. */
  cantidadMaxima?: number;
  /** Lógica condicional: ID del campo del que depende dentro del mismo formulario. */
  dependeDeCampoId?: string;
  /** Lógica condicional: Valor que debe tener el campo padre para mostrar este. */
  dependeDeValor?: string;
  /** Para tipo firma: rol/usuario que firma (ej: "Cliente", "Gerente", "Aprobador"). */
  rolFirma?: string;
  /** Para tipo firma: registra automáticamente fecha y hora de la firma. */
  registrarFechaHora?: boolean;
  /** Si es true, el campo solo se puede visualizar, no editar (útil para documentos pre-cargados por el admin). */
  soloLectura?: boolean;
  /** Para tipo grid: columnas (cabeceras) de la tabla, definidas por el diseñador. */
  tablaColumnas?: ColumnaTabla[];
  /** Para tipo grid: filas predefinidas (etiqueta fija) que el cliente debe rellenar columna por columna. */
  tablaFilas?: FilaTabla[];
  /** Layout libre (diseñador visual): posición X en píxeles dentro del canvas del formulario. */
  posX?: number;
  /** Layout libre (diseñador visual): posición Y en píxeles dentro del canvas del formulario. */
  posY?: number;
  /** Layout libre: ancho del campo en píxeles (por defecto 240). */
  largoCampo?: number;
}

/** Formulario dinámico asociado a un Paso (CU-11). */
export interface Formulario {
  id: string;
  politicaId?: string;
  nombre: string;
  descripcion?: string;
  campos: CampoFormulario[];
}

/**
 * Esquema completo del workflow persistido dentro de politica.esquema_workflow.
 * Esto es lo que se envía a PUT /api/politicas/{id}/esquema.
 */
export interface EsquemaWorkflow {
  version: number;
  tipoFlujo: TipoFlujo;
  pasos: Paso[];
  relaciones: FlujoRelacion[];
  formularios?: Formulario[];
  carriles?: Carril[];
}

/** Prioridad de un trámite (CU-12). */
export type PrioridadTramite = 'urgente' | 'normal' | 'prioritario';

/** Estado de un trámite (CU-13). */
export type EstadoTramite =
  | 'en_proceso'
  | 'completado'
  | 'cancelado'
  | 'pendiente'
  | 'en_progreso'
  | 'observado'
  | 'finalizado';
