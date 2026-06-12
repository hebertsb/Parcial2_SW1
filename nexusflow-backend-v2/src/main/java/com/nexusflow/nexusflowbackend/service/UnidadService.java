package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.Unidad_Organizacional;
import com.nexusflow.nexusflowbackend.repository.UnidadOrganizacionalRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UnidadService {

    @Autowired
    private UnidadOrganizacionalRepository unidadRepo;

    public List<Unidad_Organizacional> obtenerTodas() {
        return unidadRepo.findAll();
    }

    public List<Unidad_Organizacional> obtenerPorEmpresa(String empresaId) {
        return unidadRepo.findByEmpresa_id(empresaId);
    }

    public Unidad_Organizacional guardar(Unidad_Organizacional unidad) {
        if (unidad.getPadre_id() != null && unidad.getPadre_id().equals(unidad.getId())) {
            throw new RuntimeException("Una unidad no puede ser su propio padre (Referencia Circular).");
        }
        return unidadRepo.save(unidad);
    }

    public Optional<Unidad_Organizacional> obtenerPorId(String id) {
        return unidadRepo.findById(id);
    }

    public void eliminarLogico(String id) {
        unidadRepo.findById(id).ifPresent(unidad -> {
            // Validación: ¿Tiene hijos? (Opcional pero recomendado para calidad)
            // Aquí podrías contar si hay unidades cuyo padre_id sea este ID

            unidad.setEsta_activa(false); // Cambiamos el estado a inactivo
            unidadRepo.save(unidad);
        });
    }
}