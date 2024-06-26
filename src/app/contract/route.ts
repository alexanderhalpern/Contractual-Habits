// app/api/contract/route.ts
import { NextResponse } from "next/server";
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getDatabase, ref, push, set, Database } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBoBJJHy44VZMTQjzvifjMVEi2PmktyqYo",
  authDomain: "contractualhabits.firebaseapp.com",
  databaseURL: "https://contractualhabits-default-rtdb.firebaseio.com",
  projectId: "contractualhabits",
  storageBucket: "contractualhabits.appspot.com",
  messagingSenderId: "108956604410",
  appId: "1:108956604410:web:617d6f078bf79eff013643",
  measurementId: "G-8WECMGB467",
};

let app: FirebaseApp;
let database: Database;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
database = getDatabase(app);

export async function POST(request: Request) {
  const { action, contractId, list, todo } = await request.json();

  switch (action) {
    case "addTodo":
      const todosRef = ref(database, `contracts/${contractId}/${list}`);
      const newTodoRef = push(todosRef);
      await set(newTodoRef, todo);
      return NextResponse.json({ success: true, id: newTodoRef.key });

    case "toggleTodo":
      const toggleRef = ref(
        database,
        `contracts/${contractId}/${list}/${todo.id}`
      );
      await set(toggleRef, { ...todo, completed: !todo.completed });
      return NextResponse.json({ success: true });

    case "deleteTodo":
      const deleteRef = ref(
        database,
        `contracts/${contractId}/${list}/${todo.id}`
      );
      await set(deleteRef, null);
      return NextResponse.json({ success: true });

    case "signContract":
      const signedRef = ref(database, `contracts/${contractId}/signed`);
      await set(signedRef, true);
      return NextResponse.json({ success: true });

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
