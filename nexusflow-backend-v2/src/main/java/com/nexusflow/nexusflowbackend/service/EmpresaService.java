package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.Empresa;
import com.nexusflow.nexusflowbackend.repository.EmpresaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class EmpresaService {

    @Autowired
    private EmpresaRepository empresaRepository;

    public List<Empresa> obtenerTodas() {
        return empresaRepository.findAll();
    }

    public Optional<Empresa> obtenerPorId(String id) {
        return empresaRepository.findById(id);
    }

    public Empresa guardar(Empresa empresa) {
        return empresaRepository.save(empresa);
    }

    public void eliminar(String id) {
        empresaRepository.deleteById(id);
    }
}