from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import random

client = MongoClient('mongodb+srv://hebertsb08_db_user:g8SspkYSGab87Ecz@cluster0.lbxfuez.mongodb.net/nexusflow_oficial?retryWrites=true&w=majority')
db = client['nexusflow_oficial']

CLIENTES     = ['69dfccb5f663e82412cdba83', '69e1b5b9aa4c12289eae5f4e', '69ec461d122680675cb50c15']
FUNCIONARIOS = ['69dfcc34f663e82412cdba82', '69f02d8aa6889617eac52d84', '69f432e00d822854e1a9317d']
POLITICAS    = ['POL-CREDITO', '69e5761c86717357fbe4a96e', '69f3c15e806aa96df48515a6',
                '69f0f96a1b4f1009733012c7', '69f3c15e806aa96df48515a7', '69f3c15e806aa96df48515a8']
NODOS        = ['Registro de Solicitud', 'Revision de Analista', 'Aprobacion Gerencial',
                'Validacion Documental', 'Verificacion Crediticia', 'Desembolso', 'Cierre']
MOTIVOS_RECHAZO = [
    'No cumple requisitos crediticios',
    'Documentacion fraudulenta detectada',
    'Historial crediticio negativo',
    'Ingresos insuficientes para el monto solicitado',
    'Deuda activa con la entidad',
    'Datos de identidad no verificables',
    'Garantias insuficientes',
    'Actividad economica de alto riesgo',
]
MOTIVOS_ESCALAR = [
    'Excedio tiempo limite SLA de 72 horas',
    'Monto supera umbral de aprobacion automatica',
    'Caso requiere revision de comite directivo',
    'Alerta de compliance detectada',
    'Cliente con historial complejo requiere analisis senior',
    'Documentacion con inconsistencias graves',
]
MOTIVOS_OBSERVAR = [
    'Documentacion incompleta o ilegible',
    'Requiere comprobante de ingresos actualizado',
    'Falta firma notarial en contrato',
    'Datos del formulario no coinciden con documentos',
    'Requiere certificado de no deuda',
    'Fotografia de cedula no legible',
    'Referencias personales no verificadas',
    'Requiere avaluo de bien inmueble actualizado',
]

BASE_DATE = datetime(2026, 1, 1)

def rand_date(offset_days=0, jitter_hours=48):
    return BASE_DATE + timedelta(days=offset_days) + timedelta(hours=random.randint(0, jitter_hours))

def make_id():
    return str(ObjectId())

def bita(tramite_id, politica_id, accion, estado, usuario_id, fecha, detalle=None):
    return {
        'tramite_id': tramite_id,
        'politica_id': politica_id,
        'accion': accion,
        'estado': estado,
        'estado_resultante': estado,
        'usuario_id': usuario_id,
        'fecha_hora': fecha,
        'detalle_ia': detalle or {},
        '_class': 'com.nexusflow.nexusflowbackend.model.Bitacora'
    }

registros = []
day_offset = 0

# ============================================================
# EXTRA A: RECHAZAR x50 — 3 records cada uno = 150 registros
# Variantes: rechazo temprano, tardio, con observacion previa
# ============================================================
for i in range(50):
    tid = make_id()
    pol = random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    fun = random.choice(FUNCIONARIOS)
    t = rand_date(day_offset, 16)
    day_offset += 1
    motivo = random.choice(MOTIVOS_RECHAZO)
    horas_revision = random.randint(2, 48)

    if i < 20:
        # Rechazo rapido (sin evidencia)
        registros += [
            bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t,
                 {'campos_configurados': random.randint(2, 4)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=1)),
            bita(tid, pol, 'RECHAZAR',           'rechazado',  fun, t + timedelta(hours=horas_revision),
                 {'motivo': motivo, 'tiempo_en_nodo': horas_revision,
                  'nodo_origen': random.choice(NODOS[:3]), 'decision': 'RECHAZAR'}),
        ]
    elif i < 35:
        # Rechazo con evidencia subida pero igual rechazado
        registros += [
            bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t,
                 {'campos_configurados': random.randint(3, 5)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=1)),
            bita(tid, pol, 'SUBIDA_EVIDENCIA',   'en_proceso', cli, t + timedelta(hours=3),
                 {'archivo': 'doc_%s.pdf' % tid[:8]}),
            bita(tid, pol, 'RECHAZAR',           'rechazado',  fun, t + timedelta(hours=horas_revision + 4),
                 {'motivo': motivo, 'tiempo_en_nodo': horas_revision,
                  'nodo_origen': random.choice(NODOS[:4]), 'decision': 'RECHAZAR'}),
        ]
    else:
        # Rechazo tras observacion (cliente intento corregir pero igual fue rechazado)
        registros += [
            bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t,
                 {'campos_configurados': random.randint(2, 4)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=1)),
            bita(tid, pol, 'OBSERVAR',           'observado',  fun, t + timedelta(hours=6),
                 {'motivo': random.choice(MOTIVOS_OBSERVAR)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=30)),
            bita(tid, pol, 'RECHAZAR',           'rechazado',  fun, t + timedelta(hours=36),
                 {'motivo': motivo, 'tiempo_en_nodo': 6,
                  'nodo_origen': random.choice(NODOS[:3]), 'decision': 'RECHAZAR',
                  'intento_correccion': True}),
        ]

# ============================================================
# EXTRA B: ESCALAR x35 — 5 records cada uno = 175 registros
# Variantes: escalar y aprobar, escalar y rechazar, multi-escalar
# ============================================================
for i in range(35):
    tid = make_id()
    pol = random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    fun = random.choice(FUNCIONARIOS)
    t = rand_date(day_offset, 12)
    day_offset += 1
    motivo = random.choice(MOTIVOS_ESCALAR)
    horas_vencimiento = random.randint(72, 120)

    if i < 20:
        # Escalado → aprobado por gerencia
        n1, n2 = random.sample(NODOS[:4], 2)
        registros += [
            bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t,
                 {'campos_configurados': random.randint(3, 6)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=2)),
            bita(tid, pol, 'ESCALAR',            'escalado',   fun, t + timedelta(hours=horas_vencimiento),
                 {'motivo': motivo, 'prioridad_nueva': 'Alta',
                  'nodo_origen': n1, 'horas_vencidas': horas_vencimiento - 72}),
            bita(tid, pol, 'APROBAR',            'en_revision', fun, t + timedelta(hours=horas_vencimiento + 8),
                 {'accion': 'APROBAR', 'nodo_origen': n1, 'nodo_destino': n2,
                  'tiempo_en_nodo': random.randint(1, 8), 'post_escalamiento': True}),
            bita(tid, pol, 'FINALIZAR',          'finalizado', fun, t + timedelta(hours=horas_vencimiento + random.randint(10, 24))),
        ]
    elif i < 28:
        # Escalado → rechazado (monto muy alto o riesgo extremo)
        registros += [
            bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t,
                 {'campos_configurados': random.randint(2, 4)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=1)),
            bita(tid, pol, 'ESCALAR',            'escalado',   fun, t + timedelta(hours=horas_vencimiento),
                 {'motivo': motivo, 'prioridad_nueva': 'Alta', 'horas_vencidas': horas_vencimiento - 72}),
            bita(tid, pol, 'RECHAZAR',           'rechazado',  fun, t + timedelta(hours=horas_vencimiento + 4),
                 {'motivo': 'Riesgo inaceptable tras revision de comite',
                  'post_escalamiento': True}),
        ]
    else:
        # Multi-escalado (dos escalamientos en flujo complejo)
        n1, n2, n3 = random.sample(NODOS, 3)
        fun2 = random.choice([f for f in FUNCIONARIOS if f != fun]) or fun
        registros += [
            bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli,  t,
                 {'campos_configurados': random.randint(4, 7)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli,  t + timedelta(hours=2)),
            bita(tid, pol, 'ESCALAR',            'escalado',   fun,  t + timedelta(hours=48),
                 {'motivo': motivo, 'prioridad_nueva': 'Alta', 'escalamiento_numero': 1}),
            bita(tid, pol, 'APROBAR',            'en_revision', fun2, t + timedelta(hours=56),
                 {'accion': 'APROBAR', 'nodo_origen': n1, 'nodo_destino': n2}),
            bita(tid, pol, 'ESCALAR',            'escalado',   fun2, t + timedelta(hours=120),
                 {'motivo': 'Segundo vencimiento SLA en nodo superior', 'prioridad_nueva': 'Alta',
                  'escalamiento_numero': 2}),
            bita(tid, pol, 'FINALIZAR',          'finalizado', fun2, t + timedelta(hours=130)),
        ]

# ============================================================
# EXTRA C: OBSERVAR x25 — 6+ records cada uno = 150+ registros
# Variantes: obs simple, obs doble, obs con evidencia
# ============================================================
for i in range(25):
    tid = make_id()
    pol = random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    fun = random.choice(FUNCIONARIOS)
    t = rand_date(day_offset, 12)
    day_offset += 1
    motivo = random.choice(MOTIVOS_OBSERVAR)

    if i < 12:
        # Observacion simple → corrección → aprobado
        n1, n2 = random.sample(NODOS[:4], 2)
        registros += [
            bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t,
                 {'campos_configurados': random.randint(2, 5)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=1)),
            bita(tid, pol, 'OBSERVAR',           'observado',  fun, t + timedelta(hours=5),
                 {'motivo': motivo, 'tiempo_en_nodo': random.randint(1, 8),
                  'nodo_origen': n1, 'campos_a_corregir': random.randint(1, 3)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=28)),
            bita(tid, pol, 'APROBAR',            'en_revision', fun, t + timedelta(hours=34),
                 {'accion': 'APROBAR', 'nodo_origen': n1, 'nodo_destino': n2,
                  'tiempo_en_nodo': random.randint(2, 10)}),
            bita(tid, pol, 'FINALIZAR',          'finalizado', fun, t + timedelta(hours=random.randint(36, 60))),
        ]
    elif i < 20:
        # Observacion con subida de evidencia
        registros += [
            bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t,
                 {'campos_configurados': random.randint(3, 6)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=1)),
            bita(tid, pol, 'OBSERVAR',           'observado',  fun, t + timedelta(hours=6),
                 {'motivo': motivo, 'tiempo_en_nodo': random.randint(2, 10)}),
            bita(tid, pol, 'SUBIDA_EVIDENCIA',   'en_proceso', cli, t + timedelta(hours=26),
                 {'archivo': 'correccion_%s.pdf' % tid[:8]}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=27)),
            bita(tid, pol, 'APROBAR',            'en_revision', fun, t + timedelta(hours=32),
                 {'accion': 'APROBAR', 'tiempo_en_nodo': random.randint(2, 8)}),
            bita(tid, pol, 'FINALIZAR',          'finalizado', fun, t + timedelta(hours=random.randint(34, 56))),
        ]
    else:
        # Doble observacion (cliente tuvo que corregir dos veces)
        n1, n2 = random.sample(NODOS[:4], 2)
        registros += [
            bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t,
                 {'campos_configurados': random.randint(2, 4)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=1)),
            bita(tid, pol, 'OBSERVAR',           'observado',  fun, t + timedelta(hours=5),
                 {'motivo': motivo, 'observacion_numero': 1}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=30)),
            bita(tid, pol, 'OBSERVAR',           'observado',  fun, t + timedelta(hours=36),
                 {'motivo': random.choice(MOTIVOS_OBSERVAR), 'observacion_numero': 2,
                  'tiempo_en_nodo': random.randint(2, 6)}),
            bita(tid, pol, 'LLENADO_FORMULARIO', 'en_proceso', cli, t + timedelta(hours=60)),
            bita(tid, pol, 'APROBAR',            'en_revision', fun, t + timedelta(hours=66),
                 {'accion': 'APROBAR', 'nodo_origen': n1, 'nodo_destino': n2}),
            bita(tid, pol, 'FINALIZAR',          'finalizado', fun, t + timedelta(hours=random.randint(68, 90))),
        ]

# Insertar
result = db.Bitacora.insert_many(registros)
print('Insertados: %d registros nuevos' % len(result.inserted_ids))
total = db.Bitacora.count_documents({})
print('Total Bitacora ahora: %d' % total)

from collections import Counter
todos = list(db.Bitacora.find({}, {'accion': 1, '_id': 0}))
dist = Counter(r['accion'] for r in todos)
print('\nDistribucion de acciones:')
for k, v in sorted(dist.items(), key=lambda x: -x[1]):
    print('  %-25s %d' % (k, v))
client.close()
