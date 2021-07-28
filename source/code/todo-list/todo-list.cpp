//
// Created by Andrew Slesarenko on 04/07/2021.
//

#include "./../todo-item/todo-item.h"
#include "QtWidgets"

VectorTodoItem DefaultTodoList;

class TodoListService : public QObject
{
public:
    TodoListService();
    QVBoxLayout* GetLayout() const;

private:
    VectorTodoItem& GetTodos() const;
};

TodoListService::TodoListService()
{
    auto* first_todo  = new TodoItem("Clean cat shit", "Andrew");
    auto* second_todo = new TodoItem("Wash dishes", "Victoria");
    auto* third_todo  = new TodoItem("English language homework", "Tatyana");

    DefaultTodoList.push_back(first_todo);
    DefaultTodoList.push_back(second_todo);
    DefaultTodoList.push_back(third_todo);
};

QVBoxLayout* TodoListService::GetLayout() const
{
    auto* layout = new QVBoxLayout;

    auto todos = this->GetTodos();

    for (const auto& todo_item : todos)
    {
        QPushButton* todo_widget = todo_item->GetLayout();

        layout->addWidget(todo_widget);
    }

    return layout;
}

VectorTodoItem& TodoListService::GetTodos() const { return DefaultTodoList; }
