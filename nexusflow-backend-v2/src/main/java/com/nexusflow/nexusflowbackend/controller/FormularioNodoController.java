package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.model.Formulario_Nodo;
import com.nexusflow.nexusflowbackend.service.FormularioNodoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/configurador-nodos")
@CrossOrigin(origins = "*")
public class FormularioNodoController {

    @Autowired
    private FormularioNodoService nodoService;

    /**
     * PUT: Guardar el diseño del formulario para un nodo específico
     */
    @PutMapping("/{idDoc}/campos")
    public ResponseEntity<?> guardarEsquema(@PathVariable String idDoc, @RequestBody List<Map<String, Object>> campos) {
        try {
            Formulario_Nodo actualizado = nodoService.configurarCampos(idDoc, campos);
            return ResponseEntity.ok(actualizado);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}