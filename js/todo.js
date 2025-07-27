// 투두 리스트 기능 (함수 기반)

// 전역 변수들
let todoInput;
let addTodoBtn;
let todoList;
let todos = [];

// DOM 요소 초기화
function initTodoElements() {
    todoInput = document.getElementById('todo-input');
    addTodoBtn = document.getElementById('add-todo-btn');
    todoList = document.getElementById('todo-list');
}

// 투두 추가 함수
function addTodo() {
    const text = todoInput.value.trim();
    
    if (text) {
        const todo = {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        todos.push(todo);
        saveTodos();
        renderTodos();
        
        // 입력 필드 초기화
        todoInput.value = '';
        
        // 포커스 유지
        todoInput.focus();
    }
}

// 투두 토글 함수
function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveTodos();
        renderTodos();
    }
}

// 투두 삭제 함수
function deleteTodo(id) {
    todos = todos.filter(t => t.id !== id);
    saveTodos();
    renderTodos();
}

// 투두 목록 렌더링
function renderTodos() {
    if (!todoList) return;
    
    todoList.innerHTML = '';
    
    if (todos.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'todo-item empty-message';
        emptyMessage.textContent = 'No tasks yet. Add a new task!';
        todoList.appendChild(emptyMessage);
        return;
    }
    
    todos.forEach(todo => {
        const todoItem = document.createElement('li');
        todoItem.className = 'todo-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'todo-checkbox';
        checkbox.checked = todo.completed;
        checkbox.addEventListener('change', () => toggleTodo(todo.id));
        
        const todoText = document.createElement('span');
        todoText.className = `todo-text ${todo.completed ? 'completed' : ''}`;
        todoText.textContent = todo.text;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-todo';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteTodo(todo.id));
        
        todoItem.appendChild(checkbox);
        todoItem.appendChild(todoText);
        todoItem.appendChild(deleteBtn);
        
        todoList.appendChild(todoItem);
    });
}

// 투두 저장
function saveTodos() {
    localStorage.setItem('italianBrainrotTodos', JSON.stringify(todos));
}

// 투두 불러오기
function loadTodos() {
    const savedTodos = localStorage.getItem('italianBrainrotTodos');
    if (savedTodos) {
        todos = JSON.parse(savedTodos);
    }
}

// 완료된 투두 삭제
function clearCompleted() {
    todos = todos.filter(todo => !todo.completed);
    saveTodos();
    renderTodos();
}

// 모든 투두 삭제
function clearAll() {
    if (confirm('Are you sure you want to delete all tasks?')) {
        todos = [];
        saveTodos();
        renderTodos();
    }
}

// 이벤트 리스너 설정
function setupTodoEventListeners() {
    if (addTodoBtn) {
        addTodoBtn.addEventListener('click', addTodo);
    }
    
    if (todoInput) {
        todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addTodo();
            }
        });
    }
}

// 초기화 함수
function initTodo() {
    initTodoElements();
    loadTodos();
    setupTodoEventListeners();
    renderTodos();
}

// 페이지 로드 시 투두 매니저 초기화
document.addEventListener('DOMContentLoaded', initTodo); 