"use client";

import { useState, useEffect, useRef } from "react";
import {
  ref,
  set,
  onValue,
  push,
  get,
  DatabaseReference,
} from "firebase/database";
import { User } from "firebase/auth";
import { useRouter } from "next/navigation";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import SignatureCanvas from "react-signature-canvas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { database, auth } from "@/lib/firebase";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  timesPerWeek: number;
  completionDays: string[];
}

interface UserTodos {
  [userId: string]: {
    name: string;
    todos: Todo[];
    signature?: string;
  };
}

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onTimesPerWeekChange: (id: string, times: number) => void;
  isEditable: boolean;
  contractSigned: boolean;
  userName: string;
}

const getWeekStart = () => {
  const now = new Date();
  const first = now.getDate() - now.getDay() + 1; // Adjusts for starting week on Monday
  return new Date(now.setDate(first));
};

const getCompletedThisWeek = (completionDays: string[]) => {
  const weekStart = getWeekStart().toISOString().split("T")[0];
  const now = new Date().toISOString().split("T")[0];
  return completionDays.filter((date) => date >= weekStart && date <= now)
    .length;
};

const getProgressColor = (progress: number) => {
  const r = Math.min(255, (255 * (100 - progress)) / 100);
  const g = Math.min(225, (255 * progress) / 100);
  return `rgba(${r}, ${g}, 0, 1)`;
};

const TodoList: React.FC<TodoListProps> = ({
  todos,
  onToggle,
  onDelete,
  onTimesPerWeekChange,
  isEditable,
  contractSigned,
  userName,
}) => (
  <div>
    <h3 className="text-xl font-semibold mb-2">{userName}'s To-Do List</h3>
    <ul className="space-y-2">
      {todos.map((todo) => (
        <li
          key={todo.id}
          className="flex items-center space-x-2 justify-between"
        >
          {contractSigned && (
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => onToggle(todo.id)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={!contractSigned}
            />
          )}
          <span className={todo.completed ? "line-through" : ""}>
            {todo.text}
          </span>
          {isEditable && !contractSigned && (
            <>
              <select
                value={todo.timesPerWeek}
                onChange={(e) =>
                  onTimesPerWeekChange(todo.id, parseInt(e.target.value))
                }
              >
                {[...Array(8).keys()].map((n) => (
                  <option key={n} value={n}>
                    {n} times per week
                  </option>
                ))}
              </select>
              <button
                onClick={() => onDelete(todo.id)}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </>
          )}
          {contractSigned && (
            <span className="w-full">
              {getCompletedThisWeek(todo.completionDays)} / {todo.timesPerWeek}{" "}
              times per week
            </span>
          )}
          <div style={{ width: 70, height: 70 }}>
            <CircularProgressbar
              styles={buildStyles({
                pathColor: getProgressColor(
                  Math.min(
                    (getCompletedThisWeek(todo.completionDays) /
                      todo.timesPerWeek) *
                      100,
                    100
                  )
                ),
              })}
              value={Math.min(
                (getCompletedThisWeek(todo.completionDays) /
                  todo.timesPerWeek) *
                  100,
                100
              )}
              text={`${Math.min(
                (getCompletedThisWeek(todo.completionDays) /
                  todo.timesPerWeek) *
                  100,
                100
              ).toFixed(0)}%`}
            />
          </div>
        </li>
      ))}
    </ul>
  </div>
);

interface TodoContractProps {
  isBaseUrl?: boolean;
  contractId?: string;
}

export default function TodoContract({
  isBaseUrl = false,
  contractId: initialContractId,
}: TodoContractProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [contractId, setContractId] = useState<string | null>(
    initialContractId || null
  );
  const [userTodos, setUserTodos] = useState<UserTodos>({});
  const [newTodo, setNewTodo] = useState("");
  const [contractSigned, setContractSigned] = useState(false);
  const [punishment, setPunishment] = useState("");
  const [contractName, setContractName] = useState("");
  const [allContracts, setAllContracts] = useState<any[]>([]);

  const [weekLog, setWeekLog] = useState<any[]>([]);
  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    console.log(user, isBaseUrl, contractId);
    if (user) {
      if (isBaseUrl && !contractId) {
        const newContractRef = push(ref(database, "contracts"));
        setContractId(newContractRef.key);
      } else if (isBaseUrl) {
        const contractsRef = ref(database, "contracts");
        onValue(contractsRef, (snapshot) => {
          const data = snapshot.val();
          console.log(data);
          if (data) {
            const contractsArray = Object.entries(data).map(([key, value]) => ({
              id: key,
              ...value,
            }));
            setAllContracts(contractsArray);
          }
        });
      }
    }
  }, [user, isBaseUrl, contractId]);

  useEffect(() => {
    if (user && contractId) {
      const contractRef = ref(database, `contracts/${contractId}`);
      onValue(contractRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setContractName(data.name || "");
          const updatedUserTodos: UserTodos = {};
          Object.entries(data.users).forEach(
            ([userId, userData]: [string, any]) => {
              updatedUserTodos[userId] = {
                name: userData.name,
                todos: userData.todos
                  ? Object.entries(userData.todos).map(
                      ([todoId, todo]: [string, any]) => ({
                        id: todoId,
                        ...todo,
                        completionDays: todo.completionDays || [],
                      })
                    )
                  : [],
                signature: userData.signature || undefined,
              };
            }
          );
          setUserTodos(updatedUserTodos);
        } else {
          setUserTodos({});
        }
      });

      const signedRef = ref(database, `contracts/${contractId}/signed`);
      onValue(signedRef, (snapshot) => {
        setContractSigned(snapshot.val() || false);
      });

      const punishmentRef = ref(database, `contracts/${contractId}/punishment`);
      onValue(punishmentRef, (snapshot) => {
        setPunishment(snapshot.val() || "");
      });

      const weekLogRef = ref(database, `contracts/${contractId}/weekLog`);
      onValue(weekLogRef, (snapshot) => {
        setWeekLog(snapshot.val() || []);
      });
    }
  }, [user, contractId]);

  const updateContractName = (name: string) => {
    if (contractId) {
      const contractNameRef = ref(database, `contracts/${contractId}/name`);
      set(contractNameRef, name);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const addTodo = async () => {
    if (user && newTodo.trim() !== "" && contractId) {
      const todoRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}/todos`
      );
      const newTodoRef = push(todoRef); // This generates a unique key
      await set(newTodoRef, {
        id: newTodoRef.key, // Use the unique key as the ID
        text: newTodo,
        completed: false,
        timesPerWeek: 1,
        completionDays: [],
      });
      setNewTodo("");
    }
  };

  const toggleTodo = async (id: string) => {
    if (user && contractId) {
      const todoRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}/todos/${id}`
      );
      const snapshot = await get(todoRef);
      const todo = snapshot.val();
      if (todo) {
        const today = new Date().toISOString().split("T")[0];
        let completionDays = todo.completionDays || [];

        if (todo.completed) {
          completionDays = completionDays.filter((date) => date !== today);
        } else {
          if (!completionDays.includes(today)) {
            completionDays.push(today);
          }
        }

        await set(todoRef, {
          ...todo,
          completed: !todo.completed,
          completionDays,
        });
      }
    }
  };

  const deleteTodo = async (id: string) => {
    if (user && contractId) {
      const todoRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}/todos/${id}`
      );
      await set(todoRef, null);
    }
  };

  const signContract = async () => {
    if (user && contractId && sigCanvas.current) {
      const signatureDataUrl = sigCanvas.current.toDataURL();
      const userRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}`
      );

      // Retain the existing todos structure
      const existingTodos = userTodos[user.uid].todos.reduce(
        (acc, todo) => ({
          ...acc,
          [todo.id]: {
            text: todo.text,
            completed: todo.completed,
            timesPerWeek: todo.timesPerWeek,
            completionDays: todo.completionDays,
          },
        }),
        {}
      );

      await set(userRef, {
        ...userTodos[user.uid],
        signature: signatureDataUrl,
        todos: existingTodos,
      });

      const newUserTodos = { ...userTodos };
      newUserTodos[user.uid].signature = signatureDataUrl;

      const allSigned = Object.values(newUserTodos).every(
        (userData) => userData.signature
      );
      if (allSigned) {
        const signedRef = ref(database, `contracts/${contractId}/signed`);
        await set(signedRef, true);
        setContractSigned(true);
        await sendContractSignedEmails();
      }
    }
  };

  const sendContractSignedEmails = async () => {
    if (contractId) {
      try {
        const response = await fetch("/api/sendContractSignedEmails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contractId, users: userTodos }),
        });

        if (!response.ok) {
          throw new Error("Failed to send emails");
        }
      } catch (error) {
        console.error("Error sending emails:", error);
      }
    }
  };

  const copyContractLink = () => {
    const link = `${window.location.origin}/contract/${contractId}`;
    navigator.clipboard.writeText(link);
    alert("Contract link copied to clipboard!");
  };

  const joinContract = async () => {
    if (user && contractId) {
      const userRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}`
      );
      await set(userRef, { name: user.displayName || "Anonymous" });
    }
  };

  const onTimesPerWeekChange = async (id: string, times: number) => {
    if (user && contractId) {
      const todoRef = ref(
        database,
        `contracts/${contractId}/users/${user.uid}/todos/${id}`
      );
      const snapshot = await get(todoRef);
      const todo = snapshot.val();
      if (todo) {
        await set(todoRef, { ...todo, timesPerWeek: times });
      }
    }
  };

  const getProgressPercentage = (
    completionDays: string[],
    timesPerWeek: number
  ) => {
    const uniqueDays = [...new Set(completionDays)];
    const progress = Math.min((uniqueDays.length / timesPerWeek) * 100, 100);
    return progress;
  };

  const logWeeklyProgress = async () => {
    if (user && contractId) {
      const weekLogRef = ref(database, `contracts/${contractId}/weekLog`);
      const snapshot = await get(weekLogRef);
      const currentWeekLog = snapshot.val() || [];

      const newWeekLog = {
        week: new Date().toISOString().split("T")[0],
        users: userTodos,
      };

      await set(weekLogRef, [...currentWeekLog, newWeekLog]);

      // Reset weekly progress
      Object.keys(userTodos).forEach(async (userId) => {
        const userTodosRef = ref(
          database,
          `contracts/${contractId}/users/${userId}/todos`
        );
        Object.keys(userTodos[userId].todos).forEach(async (todoId) => {
          const todoRef = ref(
            database,
            `contracts/${contractId}/users/${userId}/todos/${todoId}`
          );
          const snapshot = await get(todoRef);
          const todo = snapshot.val();
          if (todo) {
            await set(todoRef, { ...todo, completionDays: [] });
          }
        });
      });
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-3xl font-bold mb-4">Contractual Habits</h1>
        <Button onClick={signInWithGoogle}>Sign in with Google</Button>
      </div>
    );
  }

  if (!contractId) {
    return <div>Loading contract...</div>;
  }

  if (isBaseUrl) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="mt-4 mb-8 text-center text-3xl font-bold mb-4 w-full">
          Contractual Habits
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Create a New Contractual Habit</CardTitle>
            <CardDescription>
              Share this link with your partners
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2">
              <Input
                type="text"
                value={`${window.location.origin}/contract/${contractId}`}
                readOnly
                className="flex-grow"
              />
              <Button onClick={copyContractLink}>Copy Link</Button>
            </div>
          </CardContent>
        </Card>
        {allContracts.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Available Contracts</CardTitle>

              <CardDescription>Join an existing contract</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="container mx-auto p-4 max-w-2xl">
                {allContracts.map((contract) => (
                  <Card key={contract.id} className="mb-4">
                    <CardHeader>
                      <CardTitle>{contract.name}</CardTitle>
                      <CardDescription>
                        Participants:{" "}
                        {Object.values(contract.users || {})
                          .map((user: any) => user.name)
                          .join(", ")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => router.push(`/contract/${contract.id}`)}
                      >
                        View Contract
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-4 mt-4">Contractual Habits</h1>

      {!userTodos[user.uid] && !contractSigned && (
        <Button onClick={joinContract} className="mb-4">
          Join Contract
        </Button>
      )}

      {!contractSigned && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Contract Name</CardTitle>
            <CardDescription>Set a name for this contract</CardDescription>
          </CardHeader>
          <CardContent>
            {!contractSigned ? (
              <Input
                type="text"
                value={contractName}
                onChange={(e) => {
                  setContractName(e.target.value);
                  updateContractName(e.target.value);
                }}
                placeholder="Enter contract name here"
                className="flex-grow"
              />
            ) : (
              <p>{contractName}</p>
            )}
          </CardContent>
        </Card>
      )}

      {contractSigned && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{contractName}</CardTitle>
            {/* display the names of everyone involved */}
            <CardDescription>
              The following are contractually obliged to complete their tasks:
            </CardDescription>
            <CardDescription>
              {Object.values(userTodos)
                .map((user) => user.name)
                .join(", ")}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {userTodos[user.uid] && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>My To-Do List</CardTitle>
            <CardDescription>Add and manage your tasks here</CardDescription>
          </CardHeader>
          <CardContent>
            <TodoList
              todos={userTodos[user.uid].todos}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
              onTimesPerWeekChange={onTimesPerWeekChange}
              isEditable={true}
              contractSigned={contractSigned}
              userName={userTodos[user.uid].name}
            />
            {!contractSigned && (
              <div className="flex space-x-2 mt-4">
                <Input
                  type="text"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  placeholder="Add a new todo"
                  className="flex-grow"
                />
                <Button onClick={addTodo}>Add</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {Object.entries(userTodos).map(
        ([userId, userData]) =>
          userId !== user.uid && (
            <Card key={userId} className="mb-4">
              <CardContent className="pt-4">
                <TodoList
                  todos={userData.todos}
                  onToggle={() => {}}
                  onDelete={() => {}}
                  onTimesPerWeekChange={() => {}}
                  isEditable={false}
                  contractSigned={contractSigned}
                  userName={userData.name}
                />
              </CardContent>
            </Card>
          )
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Punishment</CardTitle>
          <CardDescription>
            What happens if you don't complete your tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!contractSigned ? (
            <Input
              type="text"
              value={punishment}
              onChange={(e) => {
                if (user && contractId) {
                  const punishmentRef = ref(
                    database,
                    `contracts/${contractId}/punishment`
                  );
                  set(punishmentRef, e.target.value);
                }
              }}
              placeholder="Enter punishment here"
              className="flex-grow"
            />
          ) : (
            <p>{punishment}</p>
          )}
        </CardContent>
      </Card>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="w-full" disabled={contractSigned}>
            {contractSigned ? "Contract Signed" : "Sign Contract"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign the Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Please draw your signature below to sign the contract.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="border border-gray-300 rounded">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                width: 300,
                height: 200,
                className: "signature-canvas",
              }}
            />
          </div>
          <AlertDialogFooter>
            <Button onClick={() => sigCanvas.current?.clear()}>Clear</Button>
            <AlertDialogAction onClick={signContract}>
              Sign Contract
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {contractSigned && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Signatures</CardTitle>
          </CardHeader>
          <CardContent className="flex items-start p-4 w-full">
            {Object.entries(userTodos).map(([userId, userData]) => (
              <div key={userId} className="mb-4 mx-4 flex flex-col">
                <p>{userData.name}</p>
                {userData.signature && (
                  <img
                    src={userData.signature}
                    alt={`${userData.name}'s signature`}
                    className="mt-4 w-48 h-24 border border-gray-300 rounded"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
