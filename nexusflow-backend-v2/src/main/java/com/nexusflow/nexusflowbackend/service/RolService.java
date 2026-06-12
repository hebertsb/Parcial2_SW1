package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.Rol;
import com.nexusflow.nexusflowbackend.repository.RolRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class RolService {

    @Autowired
    private RolRepository rolRepository;

    public List<Rol> obtenerTodos() {
        return rolRepository.findAll();
    }

    public List<Rol> obtenerPorEmpresa(String empresaId) {
        // Llamamos al nuevo método con la consulta explícita
        return rolRepository.buscarPorEmpresaId(empresaId);
    }

    public Rol guardar(Rol rol) {
        return rolRepository.save(rol);
    }

    public Optional<Rol> obtenerPorId(String id) {
        return rolRepository.findById(id);
    }

    public void eliminar(String id) {
        rolRepository.deleteById(id);
    }
}