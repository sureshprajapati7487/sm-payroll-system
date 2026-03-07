const express = require('express');
const { SalesTask } = require('../database');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Auth is handled globally in index.js via authMiddleware — no local import needed

// GET /api/sales/tasks - get tasks for the current company
router.get('/tasks', async (req, res) => {
    try {
        const { companyId, role, id } = req.user;
        const query = { companyId };

        // If employee, only get their own tasks
        if (role === 'EMPLOYEE') {
            query.salesmanId = id;
        }

        const tasks = await SalesTask.findAll({
            where: query,
            order: [['createdAt', 'DESC']]
        });
        res.json(tasks);
    } catch (err) {
        console.error('Error fetching sales tasks:', err);
        res.status(500).json({ error: 'Failed to fetch sales tasks' });
    }
});

// POST /api/sales/tasks - create a new task 
router.post('/tasks', async (req, res) => {
    try {
        const { companyId } = req.user;
        const taskData = {
            id: uuidv4(),
            companyId,
            ...req.body,
            status: 'todo'
        };
        const task = await SalesTask.create(taskData);
        res.status(201).json(task);
    } catch (err) {
        console.error('Error creating sales task:', err);
        res.status(500).json({ error: 'Failed to create sales task' });
    }
});

// PUT /api/sales/tasks/:id - update task
router.put('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { companyId } = req.user;
        const task = await SalesTask.findOne({ where: { id, companyId } });

        if (!task) return res.status(404).json({ error: 'Task not found' });

        const updates = req.body;
        if (updates.status === 'done' && task.status !== 'done') {
            updates.completedAt = new Date().toISOString();
        }

        await task.update(updates);
        res.json(task);
    } catch (err) {
        console.error('Error updating sales task:', err);
        res.status(500).json({ error: 'Failed to update sales task' });
    }
});

// DELETE /api/sales/tasks/:id - update task
router.delete('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { companyId } = req.user;
        const task = await SalesTask.findOne({ where: { id, companyId } });

        if (!task) return res.status(404).json({ error: 'Task not found' });

        await task.destroy();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting sales task:', err);
        res.status(500).json({ error: 'Failed to delete sales task' });
    }
});

module.exports = router;
