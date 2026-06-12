package com.nexusflow.nexusflowbackend.util;

import java.util.Map;

/**
 * Motor de evaluación de condiciones para transiciones de nodos (CU-10, CU-12).
 * Soporta operadores lógicos: ES_IGUAL, ES_DISTINTO, MAYOR_QUE, MENOR_QUE, etc.
 */
public class CondicionEvaluador {

    /**
     * Evalúa una condición comparando el valor de un campo contra un valor esperado.
     *
     * @param respuestas     Mapa de respuestas del formulario { campoId -> valor }
     * @param condicion      Map con estructura { "campoId": "xxx", "operador": "ES_IGUAL", "valor": "yyy" }
     * @return true si la condición se cumple, false en caso contrario
     */
    public static boolean evaluar(Map<String, Object> respuestas, Map<String, Object> condicion) {
        if (respuestas == null || condicion == null) {
            return true; // Sin condición = siempre avanza
        }

        String campoId = (String) condicion.get("campoId");
        String operador = (String) condicion.get("operador");
        Object valorEsperado = condicion.get("valor");

        if (campoId == null || operador == null) {
            return true;
        }

        Object valorRespuesta = respuestas.get(campoId);

        switch (operador.toUpperCase()) {
            case "ES_IGUAL":
                return String.valueOf(valorRespuesta).equals(String.valueOf(valorEsperado));

            case "ES_DISTINTO":
                return !String.valueOf(valorRespuesta).equals(String.valueOf(valorEsperado));

            case "MAYOR_QUE":
                return toDouble(valorRespuesta) > toDouble(valorEsperado);

            case "MENOR_QUE":
                return toDouble(valorRespuesta) < toDouble(valorEsperado);

            case "MAYOR_O_IGUAL":
                return toDouble(valorRespuesta) >= toDouble(valorEsperado);

            case "MENOR_O_IGUAL":
                return toDouble(valorRespuesta) <= toDouble(valorEsperado);

            case "CONTIENE":
                return String.valueOf(valorRespuesta).contains(String.valueOf(valorEsperado));

            case "COMIENZA_CON":
                return String.valueOf(valorRespuesta).startsWith(String.valueOf(valorEsperado));

            default:
                return true; // Operador desconocido = siempre avanza
        }
    }

    /**
     * Convierte un valor a Double, retornando 0 si no es posible.
     */
    private static double toDouble(Object valor) {
        if (valor == null) return 0;
        if (valor instanceof Number) return ((Number) valor).doubleValue();
        try {
            return Double.parseDouble(String.valueOf(valor));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
